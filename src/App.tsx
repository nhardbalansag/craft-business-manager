import { useState } from 'react';
import { BrowserWorkbookExportCommand } from './application/persistence/BrowserWorkbookExportCommand';
import { BrowserWorkbookImportCommand } from './application/persistence/BrowserWorkbookImportCommand';
import { persistenceCoordinator } from './application/session';
import { CalibrationPage } from './ui/calibration/CalibrationPage';
import { MaterialsPage } from './ui/materials/MaterialsPage';
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
  readonly workbookExportCommand?: WorkbookExportCommandPort;
  readonly persistenceUiClock?: PersistenceUiClock;
}

function systemPersistenceUiClock(): Date {
  return new Date();
}

export default function App({
  workbookImportCommand,
  workbookExportCommand,
  persistenceUiClock,
}: AppProps = {}) {
  const [section, setSection] = useState<AppSection>('materials');
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [persistenceStatus, setPersistenceStatus] = useState(() =>
    createWorkbookPersistenceSessionStatus(),
  );
  const [defaultWorkbookImportCommand] = useState(
    () => new BrowserWorkbookImportCommand(persistenceCoordinator),
  );
  const [defaultWorkbookExportCommand] = useState(
    () => new BrowserWorkbookExportCommand(persistenceCoordinator),
  );
  const importCommand = workbookImportCommand ?? defaultWorkbookImportCommand;
  const exportCommand = workbookExportCommand ?? defaultWorkbookExportCommand;
  const uiClock = persistenceUiClock ?? systemPersistenceUiClock;

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
        <nav className="phase-nav" aria-label="Application sections">
          <button className={`nav-item ${section === 'materials' ? 'active' : ''}`} type="button" onClick={() => setSection('materials')}>Materials</button>
          <button className={`nav-item ${section === 'calibration' ? 'active' : ''}`} type="button" onClick={() => setSection('calibration')}>Calibration</button>
          <button className={`nav-item ${section === 'products' ? 'active' : ''}`} type="button" onClick={() => setSection('products')}>Products</button>
          <button className={`nav-item ${section === 'yield' ? 'active' : ''}`} type="button" onClick={() => setSection('yield')}>Yield</button>
          <button className={`nav-item ${section === 'production' ? 'active' : ''}`} type="button" onClick={() => setSection('production')}>Production</button>
          <button className={`nav-item ${section === 'pricing' ? 'active' : ''}`} type="button" onClick={() => setSection('pricing')}>Pricing</button>
        </nav>
      </header>

      <WorkbookPersistenceStatusPanel status={persistenceStatus} />
      <WorkbookImportPanel
        command={importCommand}
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
