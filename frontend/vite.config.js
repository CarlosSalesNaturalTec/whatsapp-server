/**
 * Arquivo: frontend/vite.config.js
 * Descrição: Configuração do Vite para o projeto React da Landing Page
 * Feature: feat-024 - Inicializar projeto React com Vite e Tailwind CSS
 * Criado em: 2026-02-26
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Output para frontend/dist/ — servido pelo Express do backend
    outDir: 'dist',
    emptyOutDir: true,
  },
});
