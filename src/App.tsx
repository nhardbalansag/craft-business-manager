import { useRef, useState } from 'react';
import { BrowserWorkbookExportCommand } from './application/persistence/BrowserWorkbookExportCommand';
import { BrowserWorkbookImportCommand } from './application/persistence/BrowserWorkbookImportCommand';
import { PublicGoogleSheetsImportCommand } from './application/persistence/PublicGoogleSheetsImportCommand';
import { persistenceCoordinator } from './application/session';
import { CalibrationPage } from './ui/calibration/CalibrationPage';
import { MaterialsPage } from './ui/materials/MaterialsPage';
import {
  PublicGoogleSheetsImportPanel,
  type PublicGoogleSheetsImportCommandPort,
} from './ui/persistence/PublicGoogleSheetsImportPanel';
import {
  WorkbookExportPanel,
  type WorkbookExportCommandPort,
} from './ui/persistence/WorkbookExportPanel';
import {
  WorkbookImportPanel,
  type WorkbookImportHydratedEvent,
} from './ui/persistence/WorkbookImportPanel';
import { WorkbookPersistenceStatusPanel } from './ui/persistence/WorkbookPersistenceStatusPanel';
import {
  createWorkbookPersistenceSessionStatus,
  recordSuccessfulWorkbookExport,
  recordSuccessfulWorkbookImport,
} from './ui/persistence/workbookPersistenceSession';
import { PricingPage } from './ui/pricing/PricingPage';
import { ProductsWorkspacePage } from './ui/products/ProductsWorkspacePage';
import { ProductionPage } from './ui/production/ProductionPage';
import { YieldPage } from './ui/yield/YieldPage';

type AppSection = 'materials' | 'calibration' | 'products' | 'yield' | 'production' | 'pricing';
export type PersistenceUiClock = () => Date;

const APP_SECTIONS: readonly { id: AppSection; label: string }[] = [
  { id: 'materials', label: 'Materials' },
  { id: 'calibration', label: 'Calibration' },
  { id: 'products', label: 'Products' },
  { id: 'yield', label: 'Yield' },
  { id: 'production', label: 'Production' },
  { id: 'pricing', label: 'Pricing' },
];

export interface AppProps {
  readonly workbookImportCommand?: BrowserWorkbookImportCommand;
  readonly publicGoogleSheetsImportCommand?: PublicGoogleSheetsImportCommandPort;
  readonly workbookExportCommand?: WorkbookExportCommandPort;
  readonly persistenceUiClock?: PersistenceUiClock;
}

function systemPersistenceUiClock(): Date {
  return new Date();
}

export default function App({
  workbookImportCommand,
  publicGoogleSheetsImportCommand,
  workbookExportCommand,
  persistenceUiClock,
}: AppProps = {}) {
  const [section, setSection] = useState<AppSection>('materials');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const workbookToolsRef = useRef<HTMLDetailsElement>(null);
  const workbookTriggerRef = useRef<HTMLElement>(null);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [persistenceStatus, setPersistenceStatus] = useState(() =>
    createWorkbookPersistenceSessionStatus(),
  );
  const [defaultWorkbookImportCommand] = useState(
    () => new BrowserWorkbookImportCommand(persistenceCoordinator),
  );
  const [defaultPublicGoogleSheetsImportCommand] = useState(
    () => new PublicGoogleSheetsImportCommand(persistenceCoordinator),
  );
  const [defaultWorkbookExportCommand] = useState(
    () => new BrowserWorkbookExportCommand(persistenceCoordinator),
  );
  const importCommand = workbookImportCommand ?? defaultWorkbookImportCommand;
  const googleSheetsImportCommand =
    publicGoogleSheetsImportCommand ?? defaultPublicGoogleSheetsImportCommand;
  const exportCommand = workbookExportCommand ?? defaultWorkbookExportCommand;
  const uiClock = persistenceUiClock ?? systemPersistenceUiClock;
  const workbookIdentityLabel =
    persistenceStatus.activeImportedWorkbook?.fileName ?? 'No workbook imported';

  function closeWorkbookTools() {
    if (workbookToolsRef.current) workbookToolsRef.current.open = false;
    workbookTriggerRef.current?.focus();
  }

  function selectSection(nextSection: AppSection) {
    setSection(nextSection);
    setDrawerOpen(false);
  }

  function handleWorkbookHydrated(event: WorkbookImportHydratedEvent) {
    const observedAt = uiClock();
    setPersistenceStatus((current) =>
      recordSuccessfulWorkbookImport(current, {
        selection: event.selection,
        result: event.result,
        observedAt,
      }),
    );
    setWorkspaceRevision((current) => current + 1);
  }

  return (
    <main className={`app-shell app-shell-with-drawer ${drawerOpen ? 'is-drawer-open' : ''}`}>
      <button
        type="button"
        className="app-drawer-toggle"
        aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={drawerOpen}
        aria-controls="app-navigation-drawer"
        onClick={() => setDrawerOpen((current) => !current)}
      >
        <span aria-hidden="true">{drawerOpen ? '×' : '☰'}</span>
        <strong>{drawerOpen ? 'Close' : 'Menu'}</strong>
      </button>

      <aside id="app-navigation-drawer" className="app-drawer" aria-label="Application navigation drawer">
        <div className="app-drawer-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">CB</div>
            <div>
              <strong>Craft Business Manager</strong>
              <span>Costing &amp; production workspace</span>
            </div>
          </div>
          <button
            type="button"
            className="app-drawer-close"
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="app-drawer-section-label">Workspace</div>
        <nav className="phase-nav app-drawer-nav" aria-label="Application sections">
          {APP_SECTIONS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${section === item.id ? 'active' : ''}`}
              type="button"
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => selectSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="app-drawer-workbook">
          <div className="app-drawer-section-label">Data</div>
          <details
            className="workbook-tools"
            ref={workbookToolsRef}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && event.currentTarget.open) {
                event.preventDefault();
                closeWorkbookTools();
              }
            }}
          >
            <summary className="workbook-tools-trigger" ref={workbookTriggerRef} aria-label="Workbook tools">
              <span className="workbook-tools-icon" aria-hidden="true">▣</span>
              <span className="workbook-tools-trigger-copy">
                <strong>Workbook</strong>
                <small title={workbookIdentityLabel}>{workbookIdentityLabel}</small>
              </span>
              <span className="workbook-tools-chevron" aria-hidden="true">⌄</span>
            </summary>

            <div className="workbook-tools-popover">
              <div className="workbook-tools-close-row">
                <button className="button button-quiet" type="button" onClick={closeWorkbookTools}>
                  Close workbook tools
                </button>
              </div>
              <div className="workbook-tools-popover-heading">
                <div>
                  <p className="panel-kicker">WORKBOOK TOOLS</p>
                  <h2>Data sources &amp; workbook copies</h2>
                  <p>
                    Open local XLSX files, import a public Google Sheets snapshot, review session
                    status, or download the current workspace as a workbook copy.
                  </p>
                </div>
                <span className="workbook-tools-current-file" title={workbookIdentityLabel}>
                  <small>Current imported source</small>
                  <strong>{workbookIdentityLabel}</strong>
                </span>
              </div>

              <WorkbookPersistenceStatusPanel status={persistenceStatus} />
              <WorkbookImportPanel command={importCommand} onHydrated={handleWorkbookHydrated} />
              <PublicGoogleSheetsImportPanel
                command={googleSheetsImportCommand}
                onHydrated={handleWorkbookHydrated}
              />
              <WorkbookExportPanel
                command={exportCommand}
                onDownloaded={(result) => {
                  const observedAt = uiClock();
                  setPersistenceStatus((current) =>
                    recordSuccessfulWorkbookExport(current, { result, observedAt }),
                  );
                }}
              />
            </div>
          </details>
        </div>
      </aside>

      {drawerOpen && (
        <button
          type="button"
          className="app-drawer-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <section className="app-content">
        <div className="workspace-revision-boundary" data-workspace-revision={workspaceRevision} key={workspaceRevision}>
          {section === 'materials' && <MaterialsPage />}
          {section === 'calibration' && <CalibrationPage />}
          {section === 'products' && <ProductsWorkspacePage />}
          {section === 'yield' && <YieldPage />}
          {section === 'production' && <ProductionPage onOpenProducts={() => selectSection('products')} />}
          {section === 'pricing' && <PricingPage />}
        </div>
      </section>
    </main>
  );
}
