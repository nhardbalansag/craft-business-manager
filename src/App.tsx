import { useState } from 'react';
import { CalibrationPage } from './ui/calibration/CalibrationPage';
import { MaterialsPage } from './ui/materials/MaterialsPage';

type AppSection = 'materials' | 'calibration';

export default function App() {
  const [section, setSection] = useState<AppSection>('materials');

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
          <button className="nav-item" type="button" disabled>Products</button>
          <button className="nav-item" type="button" disabled>Production</button>
        </nav>
      </header>

      {section === 'materials' ? <MaterialsPage /> : <CalibrationPage />}
    </main>
  );
}
