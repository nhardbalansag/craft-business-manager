import { describe, expect, it, vi } from 'vitest';
import {
  buildPhysicalLabelView,
  printPhysicalLabels,
  renderPhysicalLabelPrintHtml,
  type PhysicalLabelIdentity,
  type PhysicalLabelPrintWindow,
} from './physicalLabel';

function moldIdentity(): PhysicalLabelIdentity {
  return {
    kind: 'MOLD',
    id: 'MOLD-0012',
    title: 'Dinosaur Mold',
    eyebrow: 'Craft Business Manager · Mold',
    details: ['Product: Dinosaur Toy (PRD-00024)', 'Location: Rack A / Shelf 2 / Bin 04'],
    isActive: true,
  };
}

function locationIdentity(): PhysicalLabelIdentity {
  return {
    kind: 'LOCATION',
    id: 'LOC-BIN-0004',
    title: 'Bin 04',
    eyebrow: 'Craft Business Manager · bin',
    details: ['Rack A / Shelf 2 / Bin 04'],
    isActive: true,
  };
}

describe('physical labels', () => {
  it('renders mold identity, owning Product, current path, QR, and Code 128 SVG content', () => {
    const view = buildPhysicalLabelView(moldIdentity(), {
      sizeId: '50x30',
      copies: 1,
      showQr: true,
      showBarcode: true,
      showStatus: true,
    });

    const html = renderPhysicalLabelPrintHtml(view);

    expect(html).toContain('Dinosaur Mold');
    expect(html).toContain('MOLD-0012');
    expect(html).toContain('Product: Dinosaur Toy (PRD-00024)');
    expect(html).toContain('Location: Rack A / Shelf 2 / Bin 04');
    expect(html).toContain('<svg');
    expect(html).toContain('ACTIVE');
  });

  it('renders the authoritative Location ID and full human-readable storage path', () => {
    const view = buildPhysicalLabelView(locationIdentity(), {
      sizeId: '50x30',
      copies: 1,
      showQr: true,
      showBarcode: true,
      showStatus: false,
    });

    const html = renderPhysicalLabelPrintHtml(view);

    expect(html).toContain('LOC-BIN-0004');
    expect(html).toContain('Rack A / Shelf 2 / Bin 04');
    expect(html).not.toContain('ARCHIVED');
  });

  it('prints the requested number of copies without mutating source identity data', () => {
    const identity = moldIdentity();
    const original = structuredClone(identity);
    const view = buildPhysicalLabelView(identity, {
      sizeId: '50x30',
      copies: 3,
      showQr: false,
      showBarcode: false,
      showStatus: true,
    });
    let written = '';
    const target: PhysicalLabelPrintWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((content: string) => {
          written = content;
        }),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    };

    printPhysicalLabels(view, () => target);

    expect((written.match(/<section class="label"/g) ?? [])).toHaveLength(3);
    expect(target.focus).toHaveBeenCalledOnce();
    expect(target.print).toHaveBeenCalledOnce();
    expect(identity).toEqual(original);
  });
});
