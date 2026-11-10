import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { RenderBoundary } from './RenderBoundary';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RenderBoundary>
      <App />
    </RenderBoundary>
  </React.StrictMode>,
);
