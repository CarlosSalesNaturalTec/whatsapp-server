/**
 * Arquivo: frontend/src/App.jsx
 * Descrição: Componente raiz — compõe o layout base da Landing Page
 * Feature: feat-025 - Implementar layout base da Landing Page
 * Criado em: 2026-02-26
 *
 * Responsabilidades:
 * - Orquestrar Header fixo, área main de conteúdo e Footer
 * - Garantir estrutura HTML semântica (<header>, <main>, <footer>)
 * - Aplicar espaçamento superior no main para compensar o header fixo
 * - Servir como ponto de montagem para seções futuras (HeroSection, etc.)
 */

import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';

/**
 * Componente raiz da Landing Page — Natural Tecnologia
 *
 * Estrutura semântica:
 *   <Header /> → cabeçalho fixo com navegação
 *   <main>     → área de conteúdo (seções montadas aqui nas próximas features)
 *   <Footer /> → rodapé com contatos
 *
 * @returns {JSX.Element}
 */
function App() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">

      {/* Cabeçalho fixo — ocupa h-16 (4rem), compensado pelo pt-16 no main */}
      <Header />

      {/* Área principal de conteúdo das seções da landing page */}
      <main className="flex-1 pt-16" id="inicio" aria-label="Conteúdo principal">
        {/* feat-026: HeroSection será inserida aqui */}
      </main>

      {/* Rodapé com informações de contato */}
      <Footer />

    </div>
  );
}

export default App;
