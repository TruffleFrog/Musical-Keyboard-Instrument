import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { studio } from './app/studio';
import { AudioEngine } from './audio/engine';
import './styles/studio.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Test hook: lets automated tests drive the real engine (including offline
// rendering). Only exposed in dev builds or when ?e2e is in the URL.
if (
  import.meta.env.DEV ||
  new URLSearchParams(window.location.search).has('e2e')
) {
  (window as unknown as Record<string, unknown>).__keyboardStudio = {
    studio,
    AudioEngine,
  };
}

// Offline support: cache the app shell and piano samples after first load.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        /* offline caching is optional */
      });
  });
}
