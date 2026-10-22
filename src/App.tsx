import { useEffect, useRef, useState } from 'react';
import { BrowserWorkbookExportCommand } from './application/persistence/BrowserWorkbookExportCommand';
import { BrowserWorkbookImportCommand } from './application/persistence/BrowserWorkbookImportCommand';
import { PublicGoogleSheetsImportCommand } from './application/persistence/PublicGoogleSheetsImportCommand';
import { persistenceCoordinator } from './application/session';
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
import { ProductsWorkspacePage } from './ui/products/ProductsWorkspacePage';
import { ProductionPage } from './ui/production/ProductionPage';
import { AppIcon, type AppIconName } from './ui/icons/AppIcon';

type AppSection = 'materials' | 'products' | 'production';
export type PersistenceUiClock = () => Date;

const SIDEBAR_VISIBILITY_STORAGE_KEY = 'craft-business-manager.sidebar-visible';
const THEME_STORAGE_KEY = 'craft-business-manager.appearance';
type Appearance = 'system' | 'light' | 'dark';

function preferredAppearance(): Appearance {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function prefersDarkAppearance(): boolean {
  return typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
}

const APP_SECTIONS: readonly { id: AppSection; label: string; icon: AppIconName }[] = [
  { id: 'materials', label: 'Materials', icon: 'materials' },
  { id: 'products', label: 'Products', icon: 'products' },
  { id: 'production', label: 'Production', icon: 'production' },
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

function initialSidebarVisible(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    return window.localStorage.getItem(SIDEBAR_VISIBILITY_STORAGE_KEY) !== 'hidden';
  } catch {
    return true;
  }
}

export default function App({
  workbookImportCommand,
  publicGoogleSheetsImportCommand,
  workbookExportCommand,
  persistenceUiClock,
}: AppProps = {}) {
  const [section, setSection] = useState<AppSection>('materials');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(initialSidebarVisible);
  const [appearance, setAppearance] = useState<Appearance>(preferredAppearance);
  const [systemDark, setSystemDark] = useState(prefersDarkAppearance);
  const [workbookToolsOpen, setWorkbookToolsOpen] = useState(false);
  const workbookToolsRef = useRef<HTMLDetailsElement>(null);
  const workbookTriggerRef = useRef<HTMLElement>(null);
  const workbookCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_VISIBILITY_STORAGE_KEY,
        sidebarVisible ? 'visible' : 'hidden',
      );
    } catch {
      // Sidebar visibility remains session-local when storage is unavailable.
    }
  }, [sidebarVisible]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const resolved = appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, appearance);
    } catch {
      // Appearance remains usable if browser storage is unavailable.
    }
    return () => {
      delete document.documentElement.dataset.theme;
      document.documentElement.style.removeProperty('color-scheme');
    };
  }, [appearance, systemDark]);

  useEffect(() => {
    if (workbookToolsOpen) workbookCloseButtonRef.current?.focus();
  }, [workbookToolsOpen]);

  function setWorkbookToolsVisibility(open: boolean, returnFocus = false) {
    if (workbookToolsRef.current) workbookToolsRef.current.open = open;
    setWorkbookToolsOpen(open);
    if (!open && returnFocus) {
      const target = window.matchMedia?.('(max-width: 900px)').matches ? mobileMenuRef.current : workbookTriggerRef.current;
      target?.focus();
    }
  }

  function closeWorkbookTools() {
    setWorkbookToolsVisibility(false, true);
  }

  function toggleWorkbookTools(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    const nextOpen = !workbookToolsOpen;
    setWorkbookToolsVisibility(nextOpen);
    if (nextOpen) setDrawerOpen(false);
  }

  function toggleSidebarVisibility() {
    setSidebarVisible((current) => {
      const next = !current;
      if (!next) setWorkbookToolsVisibility(false);
      return next;
    });
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
    <main
      className={`app-shell app-shell-with-drawer ${drawerOpen ? 'is-drawer-open' : ''} ${sidebarVisible ? '' : 'is-sidebar-hidden'} ${workbookToolsOpen ? 'is-workbook-tools-open' : ''}`}
    >
      <button
        type="button"
        className="app-sidebar-toggle"
        aria-label={sidebarVisible ? 'Hide navigation sidebar' : 'Show navigation sidebar'}
        aria-expanded={sidebarVisible}
        aria-controls="app-navigation-drawer"
        onClick={toggleSidebarVisibility}
      >
        <AppIcon name={sidebarVisible ? 'chevron-left' : 'chevron-right'} size={18} />
      </button>

      <button
        type="button"
        className="app-drawer-toggle"
        ref={mobileMenuRef}
        aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={drawerOpen}
        aria-controls="app-navigation-drawer"
        onClick={() => setDrawerOpen((current) => !current)}
      >
        <AppIcon name={drawerOpen ? 'close' : 'menu'} size={18} />
        <strong>{drawerOpen ? 'Close' : 'Menu'}</strong>
      </button>

      <aside id="app-navigation-drawer" className="app-drawer" aria-label="Application navigation drawer">
        <div className="app-drawer-header">
          <div className="brand-lockup">
            <div className="brand-mark brand-mark-botanical" aria-hidden="true">
              <img src="/brand/mlc-mark.webp" alt="" width="88" height="49" />
            </div>
            <div>
              <strong>My Lovely Craft</strong>
              <span>Crafted with love</span>
            </div>
          </div>
          <button
            type="button"
            className="app-drawer-close"
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
          >
            <AppIcon name="close" size={18} />
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
              <span className={`app-nav-icon app-nav-icon-${item.id}`} aria-hidden="true"><AppIcon name={item.icon} size={18} /></span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="app-drawer-legal">
          <div className="app-drawer-section-label">Legal</div>
          <a
            href="/privacy-policy/"
            className="app-drawer-privacy-link"
            aria-label="Privacy Policy for My Lovely Craft mobile app"
          >
            Privacy Policy
          </a>
        </div>

        <div className="app-drawer-theme">
          <div className="app-drawer-section-label">Appearance</div>
          <div className="theme-switcher" role="group" aria-label="Appearance theme">
            {(['light', 'dark', 'system'] as const).map((choice) => (
              <button key={choice} type="button" className="theme-choice"
                aria-pressed={appearance === choice}
                onClick={() => setAppearance(choice)}>
                {choice.charAt(0).toUpperCase() + choice.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="app-drawer-workbook">
          <div className="app-drawer-section-label">Data</div>
          <details className="workbook-tools" ref={workbookToolsRef} open={workbookToolsOpen}>
            <summary
              className="workbook-tools-trigger"
              ref={workbookTriggerRef}
              aria-label="Workbook tools"
              aria-expanded={workbookToolsOpen}
              aria-controls="workbook-tools-dialog"
              onClick={toggleWorkbookTools}
            >
              <span className="workbook-tools-icon" aria-hidden="true"><AppIcon name="workbook" size={18} /></span>
              <span className="workbook-tools-trigger-copy">
                <strong>Workbook</strong>
                <small title={workbookIdentityLabel}>{workbookIdentityLabel}</small>
              </span>
              <span className="workbook-tools-chevron" aria-hidden="true"><AppIcon name="chevron-down" size={16} /></span>
            </summary>
          </details>
        </div>
      </aside>

      <div
        className="workbook-tools-overlay"
        hidden={!workbookToolsOpen}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeWorkbookTools();
          }
        }}
      >
        <button
          type="button"
          className="workbook-tools-backdrop"
          aria-label="Close workbook tools"
          onClick={closeWorkbookTools}
        />
        <section
          id="workbook-tools-dialog"
          className="workbook-tools-popover workbook-tools-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workbook-tools-dialog-title"
        >
          <div className="workbook-tools-close-row">
            <button
              ref={workbookCloseButtonRef}
              className="button button-quiet"
              type="button"
              onClick={closeWorkbookTools}
            >
              Close workbook tools
            </button>
          </div>
          <div className="workbook-tools-popover-heading">
            <div>
              <p className="panel-kicker">WORKBOOK TOOLS</p>
              <h2 id="workbook-tools-dialog-title">Data sources &amp; workbook copies</h2>
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
          <div className="workbook-tools-action-stack">
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
        </section>
      </div>

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
          {section === 'products' && <ProductsWorkspacePage />}
          {section === 'production' && <ProductionPage onOpenProducts={() => selectSection('products')} />}
        </div>
      </section>
    </main>
  );
}
