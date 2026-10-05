// src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import AppRoute from './config/app-route';
import { LanguageProvider } from './context/LanguageContext';
import 'rsuite/dist/rsuite.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './scss/react.scss';
import './config/axiosSetup';

export function AppRouter(): React.ReactElement | null {
  return useRoutes(AppRoute);
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element with id="root" was not found');
}

createRoot(container).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>
);
