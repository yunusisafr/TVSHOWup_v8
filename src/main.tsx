import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { loadAdUnits } from './lib/ads';
import { registerServiceWorker } from './lib/pwa';
import 'easymde/dist/easymde.min.css';
import './index.css';

// Load ad units asynchronously
(async () => {
  try {
    await loadAdUnits();
    console.log('✅ Ad units loaded successfully');
  } catch (error) {
    console.error('❌ Error loading ad units:', error);
  }
})();

// Register Service Worker for PWA support
if (import.meta.env.PROD) {
  registerServiceWorker();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);