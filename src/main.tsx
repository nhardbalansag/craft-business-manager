import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './responsive.css';
import './ui/icons/appIcons.css';
import './appDrawer.css';
import './appDrawerProfessional.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
