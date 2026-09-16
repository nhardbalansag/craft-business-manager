// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { PendingPublicGoogleSheetSelection } from './application/persistence/PublicGoogleSheetsImportCommand';
import type { PersistenceWorkbookApplyResult } from './application/persistence/PersistenceCoordinator';
import type { PublicGoogleSheetsImportCommandPort } from './ui/persistence/PublicGoogleSheetsImportPanel';

const selection: PendingPublicGoogleSheetSelection = {
  name: 'google-sheet-1234567890.xlsx',
  byteLength: 2_048,
  publishedId: '2PACX-1vExample1234567890',
  sourceUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vExample1234567890/pubhtml',
  exportUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vExample1234567890/pub?output=xlsx',
};

const hydrated: PersistenceWorkbookApplyResult = {
  status: 'hydrated',
  metadata: {
    formatId: 'craft-business-manager',
    workbookFormatVersion: 1,
    datasetSchemaVersion: 1,
    exportedAt: '2026-09-17T00:00:00.000Z',
  },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function command(): PublicGoogleSheetsImportCommandPort {
  let pending: PendingPublicGoogleSheetSelection | null = null;
  return {
    getPendingSelection: () => pending,
    clearSelection: vi.fn(() => {
      pending = null;
    }),
    loadPublishedSheet: vi.fn(async () => {
      pending = selection;
      return selection;
    }),
    applyPendingSelection: vi.fn(async () => hydrated),
  };
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

async function typeGoogleSheetsUrl() {
  const input = container.querySelector<HTMLInputElement>(
    '.public-google-sheets-panel input[type="url"]',
  )!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, selection.sourceUrl);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('App public Google Sheets integration', () => {
  it('keeps Google Sheets support inside the collapsed Workbook tools surface', async () => {
    await act(async () =>
      root.render(<App publicGoogleSheetsImportCommand={command()} />),
    );

    const details = container.querySelector<HTMLDetailsElement>('details.workbook-tools')!;
    expect(details.open).toBe(false);
    expect(details.querySelector('.workbook-tools-popover')?.textContent).toContain(
      'GOOGLE SHEETS · PUBLIC',
    );
    expect(details.querySelector('.workbook-tools-trigger')?.textContent).toContain(
      'No workbook imported',
    );
  });

  it('records a successful Google Sheets snapshot as the active imported source and refreshes once', async () => {
    const googleSheetsCommand = command();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () =>
      root.render(
        <App
          publicGoogleSheetsImportCommand={googleSheetsCommand}
          persistenceUiClock={() => new Date('2026-09-17T06:20:00.000Z')}
        />,
      ),
    );

    expect(
      container.querySelector('.workspace-revision-boundary')?.getAttribute('data-workspace-revision'),
    ).toBe('0');

    await typeGoogleSheetsUrl();
    await act(async () => button('Fetch public sheet').click());
    await act(async () => button('Apply Google Sheets import').click());

    expect(
      container.querySelector('.workspace-revision-boundary')?.getAttribute('data-workspace-revision'),
    ).toBe('1');
    expect(container.querySelector('.workbook-tools-trigger')?.textContent).toContain(selection.name);
    expect(container.querySelector('[aria-label="Active imported workbook"]')?.textContent).toContain(
      selection.name,
    );
  });
});
