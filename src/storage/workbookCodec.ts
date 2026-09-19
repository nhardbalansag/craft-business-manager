import type { WorkbookNeutralDocument } from './workbookSchema';

export type WorkbookBinaryInput = Uint8Array | ArrayBuffer;

export interface WorkbookCodec {
  encode(document: WorkbookNeutralDocument): Uint8Array;
  decode(bytes: WorkbookBinaryInput): WorkbookNeutralDocument;
}

export type WorkbookCodecErrorCode =
  | 'INVALID_DOCUMENT'
  | 'INVALID_SHEET'
  | 'INVALID_CELL_VALUE'
  | 'FORMULA_WRITE_NOT_ALLOWED'
  | 'INVALID_HEADER_CELL'
  | 'XLSX_ENCODE_FAILED'
  | 'XLSX_DECODE_FAILED';

export class WorkbookCodecError extends Error {
  readonly code: WorkbookCodecErrorCode;
  readonly causeValue?: unknown;

  constructor(code: WorkbookCodecErrorCode, message: string, causeValue?: unknown) {
    super(message);
    this.name = 'WorkbookCodecError';
    this.code = code;
    this.causeValue = causeValue;
  }
}
