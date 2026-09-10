import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from './lib/session';
import { ToastProvider } from './ui/Toast';
import { App } from './App';

import './styles/global.css';
import './styles/layout.css';
import './ui/ui.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    {/* basename matches vite's base: the app is served from /app/ so it shares
        an origin with the marketing site and the pinned Razorpay CORS. */}
    <BrowserRouter basename="/app">
      <SessionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>
);
