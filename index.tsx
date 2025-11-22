import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode is intentionally removed to prevent double-invocation of the Live API connection in dev
  // In a production app, we would handle the strict mode cleanup more robustly.
  <App />
);