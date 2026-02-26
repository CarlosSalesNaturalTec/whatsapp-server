/**
 * Arquivo: frontend/src/main.jsx
 * Descrição: Entry point do React — monta o componente raiz no DOM
 * Feature: feat-024 - Inicializar projeto React com Vite e Tailwind CSS
 * Criado em: 2026-02-26
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
