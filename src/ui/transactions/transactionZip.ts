/** Inspect the central directory before SheetJS inflates an uploaded workbook. */
export function assertTransactionZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (
    let offset = bytes.length - 22;
    offset >= Math.max(0, bytes.length - 65557);
    offset--
  ) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === bytes.length
    ) {
      end = offset;
      break;
    }
  }
  if (
    end < 0 ||
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0
  ) {
    throw new Error('Transaction workbook ZIP directory is invalid.');
  }
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    start = view.getUint32(end + 16, true);
  if (
    count < 1 ||
    count > 128 ||
    start + size > end ||
    view.getUint16(end + 8, true) !== count
  ) {
    throw new Error(
      'Transaction workbook has too many entries or invalid directory bounds.'
    );
  }
  let offset = start,
    expanded = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (
      offset + 46 > start + size ||
      view.getUint32(offset, true) !== 0x02014b50
    ) {
      throw new Error('Transaction workbook ZIP entry is invalid.');
    }
    const flags = view.getUint16(offset + 8, true),
      method = view.getUint16(offset + 10, true),
      packed = view.getUint32(offset + 20, true),
      unpacked = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true),
      extra = view.getUint16(offset + 30, true),
      comment = view.getUint16(offset + 32, true);
    const next = offset + 46 + nameLength + extra + comment;
    if (
      next > start + size ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      packed > 48 * 1024 * 1024 ||
      unpacked > 64 * 1024 * 1024
    ) {
      throw new Error(
        'Transaction workbook is encrypted, unsupported or too large.'
      );
    }
    const name = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength)
    );
    if (names.has(name) || view.getUint16(offset + 34, true) !== 0) {
      throw new Error(
        'Transaction workbook has duplicate entries or multiple disks.'
      );
    }
    names.add(name);
    expanded += unpacked;
    if (expanded > 96 * 1024 * 1024) {
      throw new Error('Transaction workbook exceeds the expanded file limit.');
    }
    offset = next;
  }
  if (offset !== start + size) {
    throw new Error('Transaction workbook directory is incomplete.');
  }
}
