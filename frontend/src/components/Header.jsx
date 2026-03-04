/**
 * Arquivo: frontend/src/components/Header.jsx
 * Descrição: Cabeçalho fixo com logotipo e navegação responsiva (mobile-first)
 * Feature: feat-025 - Implementar layout base da Landing Page
 * Criado em: 2026-02-26
 */

import { useState } from 'react';

/**
 * Link de navegação — suporta âncoras internas e rotas client-side.
 *
 * Para rotas SPA (ex: /configuracoes), usa pushState para evitar reload.
 * Para âncoras (ex: /#servicos), comportamento padrão do browser.
 *
 * @param {object}   props
 * @param {string}   props.href    - Destino (âncora ou rota)
 * @param {string}   props.label   - Texto exibido
 * @param {Function} [props.onClick] - Callback adicional (ex: fechar menu mobile)
 * @returns {JSX.Element}
 */
function NavLink({ href, label, onClick }) {
  const handleClick = (e) => {
    // Navegação client-side para rotas SPA (sem # e sem reload)
    if (href.startsWith('/') && !href.includes('#')) {
      e.preventDefault();
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    onClick?.();
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="block text-gray-700 hover:text-green-600 font-medium transition-colors duration-200 py-2 md:py-0"
    >
      {label}
    </a>
  );
}

/**
 * Cabeçalho fixo da Landing Page — Natural Tecnologia
 *
 * Responsabilidades:
 * - Exibir logotipo/nome da empresa
 * - Renderizar navegação para as seções da página
 * - Adaptar layout para mobile (menu hamburger) e desktop (barra horizontal)
 *
 * @returns {JSX.Element}
 *
 * @example
 * <Header />
 */
function Header() {
  const [menuAberto, setMenuAberto] = useState(false);

  /** Alterna a visibilidade do menu mobile */
  const toggleMenu = () => setMenuAberto((prev) => !prev);

  /** Fecha o menu após clicar em um link (navegação mobile) */
  const fecharMenu = () => setMenuAberto(false);

  // /#servicos e /#contato funcionam tanto na landing quanto na página de configurações
  const navLinks = [
    { href: '/#servicos', label: 'Serviços' },
    { href: '/#contato',  label: 'Contato'  },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logotipo / Nome da empresa */}
          <a href="#" className="flex items-center gap-2" aria-label="Natural Tecnologia — início">
            <span className="text-green-600 font-bold text-xl tracking-tight">
              Natural
            </span>
            <span className="text-gray-800 font-semibold text-xl">
              Tecnologia
            </span>
          </a>

          {/* Navegação — desktop */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Navegação principal">
            {navLinks.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} onClick={fecharMenu} />
            ))}
            <a
              href="/#contato"
              className="bg-green-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-green-700 transition-colors duration-200 text-sm"
            >
              Fale Conosco
            </a>
            {/* Ícone de configurações — link discreto para /configuracoes */}
            <NavLink
              href="/configuracoes"
              label={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-label="Configurações">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              onClick={fecharMenu}
            />
          </nav>

          {/* Botão hamburger — mobile */}
          <button
            type="button"
            onClick={toggleMenu}
            aria-expanded={menuAberto}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-green-600 hover:bg-gray-100 transition-colors duration-200"
          >
            {menuAberto ? (
              /* Ícone X (fechar) */
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              /* Ícone hambúrguer (abrir) */
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Menu expandido — mobile */}
      {menuAberto && (
        <nav
          className="md:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2"
          aria-label="Menu mobile"
        >
          {navLinks.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} onClick={fecharMenu} />
          ))}
          <NavLink href="/configuracoes" label="Configurações" onClick={fecharMenu} />
          <a
            href="/#contato"
            onClick={fecharMenu}
            className="mt-3 block text-center bg-green-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-green-700 transition-colors duration-200 text-sm"
          >
            Fale Conosco
          </a>
        </nav>
      )}
    </header>
  );
}

export default Header;
