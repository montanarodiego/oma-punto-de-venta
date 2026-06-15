import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { initTema, setTema, type TemaPref } from './theme';

// Aplica el tema del SO de forma síncrona (sin flash) antes de montar React, y
// luego pisa con la preferencia guardada en la base cuando esa lectura resuelve.
initTema();
window.api?.config?.get('tema')
  .then((v) => {
    if (v === 'auto' || v === 'claro' || v === 'oscuro') setTema(v as TemaPref, false);
  })
  .catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
