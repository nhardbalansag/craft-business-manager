import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BrowserWorkspace } from './ui/persistence/BrowserWorkspace';
import './styles.css';
import './responsive.css';
import './ui/icons/appIcons.css';
import './appDrawer.css';
import './appDrawerProfessional.css';
import './brandingTheme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserWorkspace><App /></BrowserWorkspace>
  </StrictMode>,
);
