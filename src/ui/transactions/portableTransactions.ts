import * as XLSX from 'xlsx';
import {
  validateTransactionArchive,
  mergeTransactionArchive,
  type TransactionArchive,
} from './transactionArchive';
import type { Receipt } from './models';
import type { TransactionStore } from './transactions';
import { assertTransactionZip } from './transactionZip';

export type PortableTransactionArchive = TransactionArchive & {
  images: Record<string, string>;
};
const imageReference = /^backup:\/\/image\/([a-f0-9]{64})$/;
const imageKeys = new Set([
  'uri',
  'thumbnailUri',
  'sourceImageUri',
  'sourceBrochureUri',
]);
export function emptyTransactionArchive(): PortableTransactionArchive {
  return {
    format: 'my-lovely-craft-transactions',
    version: 1,
    exportedAt: new Date().toISOString(),
    customerReceipts: [],
    quotations: [],
    transactionEntries: [],
    images: {},
  };
}
function imageReferences(
  value: unknown,
  found = new Set<string>()
): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((child) => imageReferences(child, found));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (imageKeys.has(key) && typeof child === 'string') {
        const match = imageReference.exec(child);
        if (!match) {
          throw new Error(
            'The transaction archive has a non-portable image reference.'
          );
        }
        found.add(match[1]);
      } else {
        imageReferences(child, found);
      }
    }
  }
  return found;
}
function validReceipt(value: Receipt) {
  return (
    value &&
    typeof value.title === 'string' &&
    typeof value.text === 'string' &&
    value.text.length <= 120000 &&
    (value.qr === undefined || typeof value.qr === 'string') &&
    (value.sections === undefined ||
      (Array.isArray(value.sections) &&
        value.sections.length <= 1000 &&
        value.sections.every(
          (section) =>
            section &&
            typeof section.text === 'string' &&
            [1, 2].includes(section.size) &&
            typeof section.bold === 'boolean'
        ) &&
        value.sections.map((section) => section.text).join('\n') ===
          value.text)) &&
    (value.photo === undefined ||
      (value.photo &&
        typeof value.photo.uri === 'string' &&
        typeof value.photo.thumbnailUri === 'string' &&
        [384, 576].includes(value.photo.dots)))
  );
}
export async function validatePortableTransactions(
  input: unknown
): Promise<PortableTransactionArchive> {
  const archive = validateTransactionArchive(input);
  if (
    archive.customerReceipts.some((receipt) => !validReceipt(receipt.receipt))
  ) {
    throw new Error('The archive has an invalid customer receipt document.');
  }
  const images = (input as PortableTransactionArchive).images;
  if (
    !images ||
    typeof images !== 'object' ||
    Array.isArray(images) ||
    Object.keys(images).length > 10000
  ) {
    throw new Error('Transaction image metadata is missing or invalid.');
  }
  const references = imageReferences(archive);
  if (references.size !== Object.keys(images).length) {
    throw new Error(
      'Transaction image manifest is incomplete or contains unused images.'
    );
  }
  for (const id of references) {
    const encoded = images[id];
    if (
      typeof encoded !== 'string' ||
      encoded.length < 4 ||
      encoded.length > 480000 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encoded
      )
    ) {
      throw new Error('A transaction image is missing or invalid.');
    }
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    if (
      bytes.length > 360000 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[2] !== 255
    ) {
      throw new Error('A transaction image is not a supported JPEG.');
    }
    if (!globalThis.crypto?.subtle) {
      throw new Error(
        'Open the app over HTTPS or localhost to verify transaction images.'
      );
    }
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    )
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    if (hash !== id) {
      throw new Error('A transaction image checksum is invalid.');
    }
  }
  return { ...archive, images: { ...images } };
}
export function mergePortableTransactions(
  current: PortableTransactionArchive,
  incoming: PortableTransactionArchive
) {
  const merged = mergeTransactionArchive(current, incoming);
  const references = imageReferences(merged.state);
  const images: Record<string, string> = {};
  for (const id of references) {
    const encoded = current.images[id] ?? incoming.images[id];
    if (!encoded) {
      throw new Error('A referenced transaction image is missing.');
    }
    images[id] = encoded;
  }
  return {
    archive: { ...merged.state, images, exportedAt: new Date().toISOString() },
    stats: merged.stats,
  };
}
export function scopePortableTransactions(
  current: PortableTransactionArchive,
  scope: TransactionStore
): PortableTransactionArchive {
  const images: Record<string, string> = {};
  for (const id of imageReferences(scope)) {
    images[id] = current.images[id];
  }
  return { ...current, ...scope, images, exportedAt: new Date().toISOString() };
}
export function transactionPicture(
  archive: PortableTransactionArchive,
  reference: string | undefined
) {
  const id = reference && imageReference.exec(reference)?.[1];
  return id && archive.images[id]
    ? `data:image/jpeg;base64,${archive.images[id]}`
    : null;
}
export function readTransactionWorkbook(bytes: Uint8Array): string {
  if (bytes.byteLength > 48 * 1024 * 1024) {
    throw new Error('Transaction file exceeds the 48 MB limit.');
  }
  assertTransactionZip(bytes);
  const book = XLSX.read(bytes, {
    type: 'array',
    cellHTML: false,
    cellFormula: true,
    sheetRows: 1602,
  });
  const sheet = book.Sheets.TransactionArchive;
  if (!sheet?.['!ref']) {
    throw new Error(
      'Choose a mobile transaction Excel export, not a catalog workbook.'
    );
  }
  const range = XLSX.utils.decode_range(sheet['!ref']);
  if (
    range.s.r !== 0 ||
    range.s.c !== 0 ||
    range.e.r < 1 ||
    range.e.r > 1600 ||
    range.e.c !== 1 ||
    (sheet['!fullref'] && sheet['!fullref'] !== sheet['!ref'])
  ) {
    throw new Error('Transaction workbook is too large or damaged.');
  }
  function cell(r: number, c: number) {
    const value = sheet[XLSX.utils.encode_cell({ r, c })];
    if (!value || value.f || value.F || !['s', 'n'].includes(value.t)) {
      throw new Error('Archive cells are missing or contain formulas.');
    }
    return value.v;
  }
  if (cell(0, 0) !== 'position' || cell(0, 1) !== 'content') {
    throw new Error('Transaction workbook headers are invalid.');
  }
  let text = '';
  for (let row = 1; row <= range.e.r; row++) {
    const chunk = cell(row, 1);
    if (
      cell(row, 0) !== row - 1 ||
      typeof chunk !== 'string' ||
      chunk.length < 1 ||
      chunk.length > 24000
    ) {
      throw new Error('Transaction workbook chunks are incomplete.');
    }
    text += chunk;
    if (text.length > 32 * 1024 * 1024) {
      throw new Error('Transaction archive exceeds the 32 MB limit.');
    }
  }
  return text;
}
export async function readPortableTransactions(
  file: File
): Promise<PortableTransactionArchive> {
  if (file.size > 48 * 1024 * 1024) {
    throw new Error('Transaction file exceeds the 48 MB limit.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 83 && bytes[1] === 81) {
    throw new Error(
      'Export JSON or Excel from the mobile app for web upload. SQLite is a mobile backup.'
    );
  }
  const text =
    bytes[0] === 80 && bytes[1] === 75
      ? readTransactionWorkbook(bytes)
      : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.length > 32 * 1024 * 1024) {
    throw new Error('Transaction archive exceeds the 32 MB limit.');
  }
  return validatePortableTransactions(JSON.parse(text));
}
