// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingPublicGoogleSheetSelection } from '../../application/persistence/PublicGoogleSheetsImportCommand';
import type { PersistenceWorkbookApplyResult } from '../../application/persistence/PersistenceCoordinator';
import {
  PublicGoogleSheetsImportPanel,
  type PublicGoogleSheetsImportCommandPort,
} from './PublicGoogleSheetsImportPanel';

const selection: PendingPublicGoogleSheetSelection = {
  name: 'google-sheet-1234567890.xlsx',
  byteLength: 4_096,
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

const rejected: PersistenceWorkbookApplyResult = {
  status: 'rejected',
  stage: 'import',
  issues: [
    {
      stage: 'schema',
      code: 'MISSING_SHEET',
      message: 'Required sheet Materials is missing.',
      path: 'Materials',
    },
  ],
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

function createCommand(
  applyResult: PersistenceWorkbookApplyResult = hydrated,
): PublicGoogleSheetsImportCommandPort & {
  loadPublishedSheet: ReturnType<typeof vi.fn>;
  clearSelection: ReturnType<typeof vi.fn>;
  applyPendingSelection: ReturnType<typeof vi.fn>;
} {
  let pending: PendingPublicGoogleSheetSelection | null = null;
  const loadPublishedSheet = vi.fn(async () => {
    pending = selection;
    return selection;
  });
  const clearSelection = vi.fn(() => {
    pending = null;
  });
  const applyPendingSelection = vi.fn(async () => applyResult);
  return {
    getPendingSelection: () => pending,
    loadPublishedSheet,
    clearSelection,
    applyPendingSelection,
  };
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

async function typeUrl(value = selection.sourceUrl) {
  const input = container.querySelector<HTMLInputElement>('input[type="url"]')!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function click(text: string) {
  await act(async () => button(text).click());
}

describe('PublicGoogleSheetsImportPanel', () => {
  it('explains the public-only snapshot workflow and requires a URL before fetching', async () => {
    const command = createCommand();
    await act(async () =>
      root.render(<PublicGoogleSheetsImportPanel command={command} onHydrated={vi.fn()} />),
    );

    expect(container.textContent).toContain('GOOGLE SHEETS · PUBLIC');
    expect(container.textContent).toContain('Published to the web');
    expect(container.textContent).toContain('read-only XLSX snapshot');
    expect(button('Fetch public sheet').disabled).toBe(true);
    expect(button('Apply Google Sheets import').disabled).toBe(true);
  });

  it('fetches non-destructively, then applies only after explicit confirmation', async () => {
    const command = createCommand();
    const onHydrated = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () =>
      root.render(<PublicGoogleSheetsImportPanel command={command} onHydrated={onHydrated} />),
    );

    await typeUrl();
    await click('Fetch public sheet');

    expect(command.loadPublishedSheet).toHaveBeenCalledWith(selection.sourceUrl);
    expect(command.applyPendingSelection).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="Fetched public Google Sheet"]')?.textContent).toContain(
      selection.name,
    );
    expect(container.textContent).toContain('4.0 KB');
    expect(button('Apply Google Sheets import').disabled).toBe(false);

    await click('Apply Google Sheets import');

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(command.applyPendingSelection).toHaveBeenCalledOnce();
    expect(onHydrated).toHaveBeenCalledOnce();
    expect(command.clearSelection).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('visible workspace was refreshed');
  });

  it('shows structured workbook rejection evidence without reporting a successful hydration', async () => {
    const command = createCommand(rejected);
    const onHydrated = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () =>
      root.render(<PublicGoogleSheetsImportPanel command={command} onHydrated={onHydrated} />),
    );

    await typeUrl();
    await click('Fetch public sheet');
    await click('Apply Google Sheets import');

    expect(onHydrated).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Google Sheets import rejected',
    );
    expect(container.textContent).toContain('Required sheet Materials is missing.');
  });

  it('invalidates a fetched snapshot when the source URL is edited', async () => {
    const command = createCommand();
    await act(async () =>
      root.render(<PublicGoogleSheetsImportPanel command={command} onHydrated={vi.fn()} />),
    );

    await typeUrl();
    await click('Fetch public sheet');
    expect(button('Apply Google Sheets import').disabled).toBe(false);

    await typeUrl(`${selection.sourceUrl}?changed=1`);

    expect(command.clearSelection).toHaveBeenCalledOnce();
    expect(button('Apply Google Sheets import').disabled).toBe(true);
    expect(container.querySelector('[aria-label="Fetched public Google Sheet"]')).toBeNull();
  });
});
