import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installPdfLinkGuard } from './lib/pdf';
import './styles.css';

installPdfLinkGuard();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
