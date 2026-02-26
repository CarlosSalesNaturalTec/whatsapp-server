/**
 * Arquivo: frontend/tailwind.config.js
 * Descrição: Configuração do Tailwind CSS para a Landing Page
 * Feature: feat-024 - Inicializar projeto React com Vite e Tailwind CSS
 * Criado em: 2026-02-26
 */

/** @type {import('tailwindcss').Config} */
export default {
  // Escaneia apenas os arquivos JSX/JS do src para geração de classes utilitárias
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
