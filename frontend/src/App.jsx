/**
 * Arquivo: frontend/src/App.jsx
 * Descrição: Componente raiz — compõe o layout base com Header, seções e Footer
 * Feature: feat-026 - Implementar seção Hero da Landing Page
 * Criado em: 2026-02-26
 *
 * Responsabilidades:
 * - Orquestrar Header fixo, seções de conteúdo e Footer
 * - Garantir estrutura HTML semântica (<header>, <main>, <footer>)
 * - Aplicar espaçamento superior no main para compensar o header fixo (h-16)
 */

import Header      from './components/Header.jsx';
import HeroSection from './components/HeroSection.jsx';
import Footer      from './components/Footer.jsx';

/**
 * Componente raiz da Landing Page — Natural Tecnologia
 *
 * Estrutura semântica:
 *   <Header />      → cabeçalho fixo com navegação
 *   <main>
 *     <HeroSection /> → título, subtítulo, CTA e ilustração
 *   </main>
 *   <Footer />      → rodapé com contatos
 *
 * @returns {JSX.Element}
 */
function App() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">

      {/* Cabeçalho fixo — ocupa h-16 (4rem), compensado pelo pt-16 no main */}
      <Header />

      {/* Área principal de conteúdo */}
      <main className="flex-1 pt-16" id="inicio" aria-label="Conteúdo principal">
        <HeroSection />
      </main>

      {/* Rodapé com informações de contato */}
      <Footer />

    </div>
  );
}

export default App;
