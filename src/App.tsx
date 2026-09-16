import { useState } from 'react';
import { BrowserWorkbookImportCommand } from './application/persistence/BrowserWorkbookImportCommand';
import { persistenceCoordinator } from './application/session';
import { CalibrationPage } from './ui/calibration/CalibrationPage';
import { MaterialsPage } from './ui/materials/MaterialsPage';
import { WorkbookImportPanel } from './ui/persistence/WorkbookImportPanel';
import { PricingPage } from './ui/pricing/PricingPage';
import { ProductsPage } from './ui/products/ProductsPage';
import { ProductionPage } from './ui/production/ProductionPage';
import { YieldPage } from './ui/yield/YieldPage';

type AppSection = 'materials' | 'calibration' | 'products' | 'yield' | 'production' | 'pricing';

export interface AppProps {
  readonly workbookImportCommand?: BrowserWorkbookImportCommand;
}

export default function App({ workbookImportCommand }: AppProps = {}) {
  const [section, setSection] = useState<AppSection>('materials');
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [defaultWorkbookImportCommand] = useState(
    () => new BrowserWorkbookImportCommand(persistenceCoordinator),
  );
  const importCommand = workbookImportCommand ?? defaultWorkbookImportCommand;

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

      <WorkbookImportPanel
        command={importCommand}
        onHydrated={() => setWorkspaceRevision((current) => current + 1)}
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
