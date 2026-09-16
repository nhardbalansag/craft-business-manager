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
import { ProductsPage } from './ui/products/ProductsPage';
import { ProductionPage } from './ui/production/ProductionPage';
import { YieldPage } from './ui/yield/YieldPage';

type AppSection = 'materials' | 'calibration' | 'products' | 'yield' | 'production' | 'pricing';
export type PersistenceUiClock = () => Date;

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
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">CB</div>
          <div>
            <strong>Craft Business Manager</strong>
            <span>Costing & production workspace</span>
          </div>
        </div>

        <div className="app-header-actions">
          <nav className="phase-nav" aria-label="Application sections">
            <button className={`nav-item ${section === 'materials' ? 'active' : ''}`} type="button" aria-current={section === 'materials' ? 'page' : undefined} onClick={() => setSection('materials')}>Materials</button>
            <button className={`nav-item ${section === 'calibration' ? 'active' : ''}`} type="button" aria-current={section === 'calibration' ? 'page' : undefined} onClick={() => setSection('calibration')}>Calibration</button>
            <button className={`nav-item ${section === 'products' ? 'active' : ''}`} type="button" aria-current={section === 'products' ? 'page' : undefined} onClick={() => setSection('products')}>Products</button>
            <button className={`nav-item ${section === 'yield' ? 'active' : ''}`} type="button" aria-current={section === 'yield' ? 'page' : undefined} onClick={() => setSection('yield')}>Yield</button>
            <button className={`nav-item ${section === 'production' ? 'active' : ''}`} type="button" aria-current={section === 'production' ? 'page' : undefined} onClick={() => setSection('production')}>Production</button>
            <button className={`nav-item ${section === 'pricing' ? 'active' : ''}`} type="button" aria-current={section === 'pricing' ? 'page' : undefined} onClick={() => setSection('pricing')}>Pricing</button>
          </nav>

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
                  <h2>Data sources & workbook copies</h2>
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
              <WorkbookImportPanel
                command={importCommand}
                onHydrated={handleWorkbookHydrated}
              />
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
      </header>

      <div className="workspace-revision-boundary" data-workspace-revision={workspaceRevision} key={workspaceRevision}>
        {section === 'materials' && <MaterialsPage />}
        {section === 'calibration' && <CalibrationPage />}
        {section === 'products' && <ProductsPage />}
        {section === 'yield' && <YieldPage />}
        {section === 'production' && <ProductionPage onOpenProducts={() => setSection('products')} />}
        {section === 'pricing' && <PricingPage />}
      </div>
    </main>
  );
}
