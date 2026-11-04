import { WorkbookCodecError } from './workbookCodec';
import type { WorkbookNeutralDocument, WorkbookNeutralSheet } from './workbookSchema';

export const EXCEL_TEXT_LIMIT = 32767;
export const LONG_TEXT_SHEET = '_CraftLongText';
const columns = ['cellId', 'sheet', 'row', 'column', 'part', 'parts', 'text'];
const MAX_LONG_TEXT = 32 * 1024 * 1024;

function prefix(value: string, end: number) {
  // SheetJS measures UTF-16 code units. Keep surrogate pairs together in each fragment.
  const last = value.charCodeAt(end - 1);
  return value.slice(0, last >= 0xd800 && last <= 0xdbff ? end - 1 : end);
}
function fragments(value: string) {
  const result: string[] = [];
  for (let offset = 0; offset < value.length;) {
    const chunk = prefix(value.slice(offset), 24000);
    result.push(chunk); offset += chunk.length;
  }
  return result;
}
function preview(value: string, id: string) {
  const suffix = `\n[Continued in ${LONG_TEXT_SHEET}: ${id}]`;
  return prefix(value, EXCEL_TEXT_LIMIT - suffix.length) + suffix;
}
function invalid(message: string): never { throw new WorkbookCodecError('INVALID_DOCUMENT', message); }

/** XLSX cells are bounded, while SQLite text is not. Preserve overflow in a hidden continuation sheet. */
export function splitWorkbookLongText(document: WorkbookNeutralDocument): WorkbookNeutralDocument {
  if (document.sheets.some(s => s.name === LONG_TEXT_SHEET)) invalid(`${LONG_TEXT_SHEET} is reserved for workbook text continuations.`);
  const continuationRows: Record<string, unknown>[] = [];
  const continuation: WorkbookNeutralSheet = { name: LONG_TEXT_SHEET, columns, rows: continuationRows };
  let total = 0;
  const sheets = document.sheets.map((sheet, sheetIndex) => ({ ...sheet, rows: sheet.rows.map((row, rowIndex) => {
    let result = row;
    sheet.columns.forEach((column, columnIndex) => {
      const value = row[column];
      if (typeof value !== 'string' || value.length <= EXCEL_TEXT_LIMIT) return;
      total += value.length;
      if (total > MAX_LONG_TEXT) invalid('Workbook long text exceeds 32 MB. Use a SQLite backup to preserve this data.');
      const id = `S${sheetIndex}-R${rowIndex + 2}-C${columnIndex + 1}`, chunks = fragments(value);
      chunks.forEach((text, index) => continuationRows.push({ cellId: id, sheet: sheet.name, row: rowIndex + 2, column, part: index + 1, parts: chunks.length, text }));
      result = { ...result, [column]: preview(value, id) };
    });
    return result;
  }) }));
  return continuation.rows.length ? { sheets: [...sheets, continuation] } : document;
}

/** Validate every target and fragment before returning a normal document to schema/import validation. */
export function restoreWorkbookLongText(document: WorkbookNeutralDocument): WorkbookNeutralDocument {
  const continuation = document.sheets.find(s => s.name === LONG_TEXT_SHEET);
  const pendingMarker = (value: unknown) => typeof value === 'string' && value.length <= EXCEL_TEXT_LIMIT && /\n\[Continued in _CraftLongText: S\d+-R\d+-C\d+\]$/.test(value);
  function assertComplete(sheets: readonly WorkbookNeutralSheet[]) {
    for (const sheet of sheets) for (const row of sheet.rows) for (const column of sheet.columns) {
      if (pendingMarker(row[column])) invalid(`The long-text continuation for ${sheet.name}.${column} is missing. Keep the hidden ${LONG_TEXT_SHEET} sheet or use the original SQLite backup.`);
    }
  }
  if (!continuation) { assertComplete(document.sheets); return document; }
  if (continuation.columns.length !== columns.length || !columns.every((c, i) => continuation.columns[i] === c)) invalid('The workbook long-text continuation columns are invalid. Re-export the workbook or restore its SQLite backup.');
  const groups = new Map<string, { sheet: string; row: number; column: string; parts: number; chunks: Map<number, string> }>();
  let total = 0;
  for (const row of continuation.rows) {
    const { cellId, sheet, column, part, parts, text } = row;
    if (typeof cellId !== 'string' || cellId.length > 100 || typeof sheet !== 'string' || typeof column !== 'string' ||
      !Number.isSafeInteger(row.row) || Number(row.row) < 2 || !Number.isSafeInteger(part) || !Number.isSafeInteger(parts) || Number(part) < 1 || Number(part) > Number(parts) || Number(parts) > 2000 ||
      typeof text !== 'string' || !text.length || text.length > EXCEL_TEXT_LIMIT) invalid('The workbook contains invalid long-text continuation records.');
    total += text.length;
    if (total > MAX_LONG_TEXT) invalid('Workbook long text exceeds the 32 MB import limit.');
    const group = groups.get(cellId) ?? { sheet, row: Number(row.row), column, parts: Number(parts), chunks: new Map<number, string>() };
    if (group.sheet !== sheet || group.row !== row.row || group.column !== column || group.parts !== parts || group.chunks.has(Number(part))) invalid('The workbook contains conflicting or duplicate long-text fragments.');
    group.chunks.set(Number(part), text); groups.set(cellId, group);
  }
  const sheets = document.sheets.filter(s => s.name !== LONG_TEXT_SHEET).map(s => ({ ...s, rows: [...s.rows] }));
  const targets = new Set<string>();
  for (const [id, group] of groups) {
    const sheetIndex = sheets.findIndex(s => s.name === group.sheet), sheet = sheets[sheetIndex];
    const columnIndex = sheet?.columns.indexOf(group.column) ?? -1;
    const expectedId = `S${sheetIndex}-R${group.row}-C${columnIndex + 1}`;
    if (!sheet || columnIndex < 0 || !sheet.rows[group.row - 2] || id !== expectedId || targets.has(id) || group.chunks.size !== group.parts) invalid('The workbook is missing long-text fragments or their original cell. Re-export it or restore a SQLite backup.');
    const value = Array.from({ length: group.parts }, (_, index) => group.chunks.get(index + 1) ?? invalid('The workbook is missing a long-text fragment.')).join('');
    if (sheet.rows[group.row - 2][group.column] !== preview(value, id)) invalid(`The long text in ${group.sheet}.${group.column}, Excel row ${group.row}, was changed or its continuation data is damaged. Keep its continuation sheet when editing or use the original SQLite backup.`);
    targets.add(id); sheet.rows[group.row - 2] = { ...sheet.rows[group.row - 2], [group.column]: value };
  }
  assertComplete(sheets);
  return { sheets };
}
