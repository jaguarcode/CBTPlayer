import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// Global error handler to catch any uncaught errors
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler] Uncaught error:', event.error);
  console.error('[Global Error Handler] Stack:', event.error?.stack);
  console.error('[Global Error Handler] Message:', event.message);
  console.error('[Global Error Handler] Filename:', event.filename);
  console.error('[Global Error Handler] Line:', event.lineno, 'Column:', event.colno);
  // Prevent the default error handling
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Error Handler] Unhandled promise rejection:', event.reason);
  console.error('[Global Error Handler] Promise:', event.promise);
  // Prevent the default error handling
  event.preventDefault();
});

// Log when the page starts
console.log('[Renderer] Starting application...');

// Initialize React app
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('[Renderer] React app rendered');