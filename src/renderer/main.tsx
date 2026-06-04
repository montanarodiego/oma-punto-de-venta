import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// HUD size init
const hud = localStorage.getItem('oma_hud') ?? 'normal';
document.documentElement.classList.add('hud-' + hud);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
