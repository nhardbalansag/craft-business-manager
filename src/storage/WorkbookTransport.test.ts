import { describe, expect, it } from 'vitest';
import {
  InMemoryWorkbookTransport,
  InMemoryWorkbookTransportError,
} from './InMemoryWorkbookTransport';
import { cloneWorkbookBytes } from './WorkbookTransport';

describe('WorkbookTransport', () => {
  it('defensively clones Uint8Array input', () => {
    const source = new Uint8Array([1, 2, 3]);
    const cloned = cloneWorkbookBytes(source);

    source[0] = 99;

    expect(Array.from(cloned)).toEqual([1, 2, 3]);
  });

  it('defensively clones ArrayBuffer input', () => {
    const source = new Uint8Array([4, 5, 6]);
    const cloned = cloneWorkbookBytes(source.buffer);

    source[1] = 99;

    expect(Array.from(cloned)).toEqual([4, 5, 6]);
  });

  it('owns saved bytes independently from the caller', async () => {
    const transport = new InMemoryWorkbookTransport();
    const bytes = new Uint8Array([10, 20, 30]);

    await transport.saveWorkbook(bytes);
    bytes[0] = 200;

    expect(Array.from(await transport.loadWorkbook())).toEqual([10, 20, 30]);
  });

  it('returns defensive copies from load', async () => {
    const transport = new InMemoryWorkbookTransport(new Uint8Array([7, 8, 9]));

    const first = await transport.loadWorkbook();
    first[2] = 100;

    expect(Array.from(await transport.loadWorkbook())).toEqual([7, 8, 9]);
  });

  it('reports backup as not requested by default', async () => {
    const transport = new InMemoryWorkbookTransport();

    const receipt = await transport.saveWorkbook(new Uint8Array([1]));

    expect(receipt).toEqual({
      reference: 'memory://workbook',
      backup: { status: 'not-requested' },
    });
  });

  it('reports an optional backup request as unsupported without implementing backup behavior', async () => {
    const transport = new InMemoryWorkbookTransport(new Uint8Array([1, 2]));

    const receipt = await transport.saveWorkbook(new Uint8Array([3, 4]), {
      backup: 'if-supported',
    });

    expect(receipt).toEqual({
      reference: 'memory://workbook',
      backup: { status: 'unsupported' },
    });
    expect(Array.from(await transport.loadWorkbook())).toEqual([3, 4]);
  });

  it('fails deterministically when no workbook is available to load', async () => {
    const transport = new InMemoryWorkbookTransport();

    await expect(transport.loadWorkbook()).rejects.toMatchObject({
      name: 'InMemoryWorkbookTransportError',
      code: 'NO_WORKBOOK_AVAILABLE',
    } satisfies Partial<InMemoryWorkbookTransportError>);
  });

  it('treats arbitrary bytes as transport data rather than validating workbook or business semantics', async () => {
    const transport = new InMemoryWorkbookTransport();
    const arbitraryBytes = new Uint8Array([0, 255, 17, 42]);

    await transport.saveWorkbook(arbitraryBytes);

    expect(Array.from(await transport.loadWorkbook())).toEqual([0, 255, 17, 42]);
  });
});
