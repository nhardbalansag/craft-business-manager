import type { WorkbookNeutralDocument } from './workbookSchema';

export type WorkbookBinaryInput = Uint8Array | ArrayBuffer;

export interface WorkbookCodec {
  encode(document: WorkbookNeutralDocument): Uint8Array;
  decode(bytes: WorkbookBinaryInput): WorkbookNeutralDocument;
}

/** Import-local cache: shape detection and validation share one binary decode. */
export function createWorkbookDecodeSession(codec: WorkbookCodec): WorkbookCodec {
  const decoded = new WeakMap<WorkbookBinaryInput, { document: WorkbookNeutralDocument } | { error: unknown }>();
  return {
    encode: (document) => codec.encode(document),
    decode(bytes) {
      let result = decoded.get(bytes);
      if (!result) {
        try { result = { document: codec.decode(bytes) }; }
        catch (error) { result = { error }; }
        decoded.set(bytes, result);
      }
      if ('error' in result) throw result.error;
      return result.document;
    },
  };
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
