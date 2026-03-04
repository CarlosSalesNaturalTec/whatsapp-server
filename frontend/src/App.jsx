/**
 * Arquivo: frontend/src/App.jsx
 * Descrição: Componente raiz com roteamento client-side simples baseado em pathname.
 *
 * Rotas:
 *   /               → Landing Page (Header + HeroSection + Footer)
 *   /configuracoes  → Página de configurações da conexão WhatsApp
 *
 * O roteamento usa window.history.pushState + evento 'popstate' — sem dependência
 * de react-router-dom. O Express já serve index.html para qualquer rota (/*)
 * via o catch-all em src/server/index.js, portanto acesso direto via URL funciona.
 *
 * Criado em: 2026-02-26
 * Atualizado em: 2026-03-03 — roteamento client-side para /configuracoes
 */

import { useState, useEffect } from 'react';
import Header      from './components/Header.jsx';
import HeroSection from './components/HeroSection.jsx';
import Footer      from './components/Footer.jsx';
import Settings    from './pages/Settings.jsx';

/**
 * Componente raiz — detecta a rota atual e renderiza a página correspondente.
 *
 * @returns {JSX.Element}
 */
function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    // Atualiza a rota ao navegar com pushState (NavLink) ou botão voltar/avançar do browser
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Página de configurações
  if (currentPath === '/configuracoes') {
    return <Settings />;
  }

  // Landing Page (rota padrão — qualquer pathname não mapeado)
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
