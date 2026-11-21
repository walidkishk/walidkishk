import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

if (import.meta.env.PROD) {
  try {
    registerSW({ immediate: true });
  } catch {
    // Ignore SW registration failures in restricted browser contexts
  }
} else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  void (async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
      if (hadController) {
        let alreadyCleaned = false;
        try {
          alreadyCleaned = Boolean(window.sessionStorage.getItem('dev_sw_cleaned'));
          if (!alreadyCleaned) {
            window.sessionStorage.setItem('dev_sw_cleaned', '1');
          }
        } catch {
          alreadyCleaned = true;
        }
        if (!alreadyCleaned) {
          window.location.reload();
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  })();
}

const rootEl = document.getElementById('root')!;
(window as unknown as { __APP_MOUNTED__?: boolean }).__APP_MOUNTED__ = true;
rootEl.setAttribute('data-app-mounted', '1');

createRoot(rootEl).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
