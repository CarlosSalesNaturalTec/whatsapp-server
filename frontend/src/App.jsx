/**
 * Arquivo: frontend/src/App.jsx
 * Descrição: Componente raiz da aplicação React — ponto de entrada da Landing Page
 * Feature: feat-024 - Inicializar projeto React com Vite e Tailwind CSS
 * Criado em: 2026-02-26
 *
 * Responsabilidades:
 * - Servir como raiz da árvore de componentes React
 * - Estrutura base a ser expandida nas features feat-025 (layout) e feat-026 (Hero)
 */

/**
 * Componente raiz da Landing Page — Natural Tecnologia
 *
 * @returns {JSX.Element} Estrutura base da aplicação
 */
function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <p className="text-center p-8 text-lg text-gray-500">
        Natural Tecnologia — Landing Page
      </p>
    </div>
  );
}

export default App;
