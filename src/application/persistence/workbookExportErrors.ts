/** Reveal actionable causes without dumping source records, image data or stack traces into the UI. */
export function workbookExportErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'The workbook export failed unexpectedly.';
  const messages: string[] = [error.message], seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current && !seen.has(current); depth++) {
    seen.add(current);
    if (typeof current !== 'object') break;
    const value = current as Record<string, unknown>;
    const issues = [value.datasetIssues, value.workbookIssues, value.issues].find(Array.isArray) as Record<string, unknown>[] | undefined;
    if (issues?.length) {
      for (const issue of issues.slice(0, 3)) {
        if (!issue || typeof issue.message !== 'string') continue;
        const location = typeof issue.path === 'string' ? issue.path :
          [issue.sheetName, issue.column, typeof issue.rowIndex === 'number' ? `Excel row ${issue.rowIndex + 2}` : ''].filter(v => typeof v === 'string' && v).join(' · ');
        messages.push(`${location ? `${location}: ` : ''}${issue.message}`);
      }
      if (issues.length > 3) messages.push(`${issues.length - 3} more validation issue(s).`);
      break;
    }
    if (typeof value.message === 'string' && value.message.trim()) messages.push(value.message.trim().slice(0, 700));
    current = value.causeValue ?? value.cause;
  }
  const unique = [...new Set(messages)], reason = unique.length > 1 ? unique.slice(1).join(' ') : '';
  const text = `${error.message}${reason ? ` Reason: ${reason}` : ''}`;
  if (/dynamically imported|loading chunk|module script|failed to fetch/i.test(text)) return `${text} Excel support could not load. Save your edits, then reopen the app and retry.`;
  if ('stage' in error && ['export', 'snapshot'].includes(String(error.stage))) return `${text} Your saved records are unchanged. You can also download a workbook without pictures or use Download SQLite backup for a complete backup.`;
  return text;
}
