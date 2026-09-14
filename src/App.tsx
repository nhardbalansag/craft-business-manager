import { MaterialsPage } from './ui/materials/MaterialsPage';

export default function App() {
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
          <button className="nav-item active" type="button">Materials</button>
          <button className="nav-item" type="button" disabled>Calibration</button>
          <button className="nav-item" type="button" disabled>Products</button>
          <button className="nav-item" type="button" disabled>Production</button>
        </nav>
      </header>

      <MaterialsPage />
    </main>
  );
}
