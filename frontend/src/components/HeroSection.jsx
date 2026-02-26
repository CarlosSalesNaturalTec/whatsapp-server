/**
 * Arquivo: frontend/src/components/HeroSection.jsx
 * Descrição: Seção Hero da Landing Page — título, subtítulo, CTA e ilustração SVG
 * Feature: feat-026 - Implementar seção Hero da Landing Page
 * Criado em: 2026-02-26
 */

/**
 * Pílula destacando um serviço oferecido pela empresa
 *
 * @param {object} props
 * @param {JSX.Element} props.icon  - Ícone SVG do serviço
 * @param {string}      props.texto - Descrição curta do serviço
 * @returns {JSX.Element}
 */
function ServicoPilula({ icon, texto }) {
  return (
    <li className="flex items-center gap-2 bg-white border border-green-100 rounded-full px-4 py-2 text-sm text-gray-700 shadow-sm">
      <span className="text-green-600 shrink-0" aria-hidden="true">{icon}</span>
      {texto}
    </li>
  );
}

/**
 * Ilustração SVG inline representando tecnologia digital e automação
 *
 * Composição visual:
 * - Mockup de smartphone com tela de chat (WhatsApp automation)
 * - Badges flutuantes representando os 4 serviços
 * - Linhas de conexão indicando integração entre serviços
 * - Paleta verde alinhada à identidade da marca
 *
 * @returns {JSX.Element}
 */
function IlustracaoTech() {
  return (
    <svg
      viewBox="0 0 480 420"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className="w-full max-w-md mx-auto"
    >
      <defs>
        <filter id="sombra-badge" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#00000018" />
        </filter>
        <linearGradient id="grad-tela" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#111827" />
          <stop offset="100%" stopColor="#1f2937" />
        </linearGradient>
        <linearGradient id="grad-fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0fdf4" />
          <stop offset="100%" stopColor="#dcfce7" />
        </linearGradient>
      </defs>

      {/* Círculo de fundo */}
      <circle cx="240" cy="210" r="185" fill="url(#grad-fundo)" />
      <circle cx="240" cy="210" r="140" fill="#bbf7d040" />

      {/* ── Mockup de smartphone ── */}
      {/* Corpo do aparelho */}
      <rect x="175" y="70" width="130" height="250" rx="22" fill="#1f2937" />
      {/* Tela */}
      <rect x="184" y="86" width="112" height="218" rx="12" fill="url(#grad-tela)" />
      {/* Notch */}
      <rect x="218" y="83" width="44" height="8" rx="4" fill="#374151" />
      {/* Barra de status */}
      <rect x="192" y="100" width="40" height="4" rx="2" fill="#4b556340" />
      <rect x="272" y="100" width="16" height="4" rx="2" fill="#4b556340" />

      {/* Cabeçalho do chat na tela */}
      <circle cx="204" cy="122" r="9" fill="#16a34a" />
      <rect x="218" y="117" width="50" height="5" rx="2.5" fill="#6b7280" />
      <rect x="218" y="125" width="30" height="3" rx="1.5" fill="#9ca3af" />

      {/* Balões de chat */}
      {/* Mensagem recebida 1 */}
      <rect x="192" y="142" width="72" height="20" rx="10" fill="#374151" />
      <rect x="192" y="142" width="20" height="20" rx="10" fill="#374151" />
      <text x="202" y="156" fontSize="8" fill="#d1d5db" fontFamily="sans-serif">#iniciarBot#</text>

      {/* Resposta do bot 1 */}
      <rect x="218" y="170" width="70" height="20" rx="10" fill="#16a34a" />
      <rect x="268" y="170" width="20" height="20" rx="10" fill="#16a34a" />
      <text x="226" y="184" fontSize="8" fill="white" fontFamily="sans-serif">Bot Iniciado ✓</text>

      {/* Mensagem recebida 2 */}
      <rect x="192" y="198" width="60" height="20" rx="10" fill="#374151" />
      <rect x="192" y="198" width="20" height="20" rx="10" fill="#374151" />
      <text x="202" y="212" fontSize="8" fill="#d1d5db" fontFamily="sans-serif">Olá! 👋</text>

      {/* Resposta do bot 2 */}
      <rect x="216" y="226" width="72" height="20" rx="10" fill="#16a34a" />
      <rect x="268" y="226" width="20" height="20" rx="10" fill="#16a34a" />
      <text x="222" y="240" fontSize="8" fill="white" fontFamily="sans-serif">Posso ajudar!</text>

      {/* Barra de digitação */}
      <rect x="192" y="278" width="96" height="16" rx="8" fill="#374151" />

      {/* ── Linhas de conexão ── */}
      <line x1="128" y1="118" x2="175" y2="148" stroke="#86efac" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="352" y1="130" x2="305" y2="152" stroke="#86efac" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="112" y1="298" x2="175" y2="268" stroke="#86efac" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="360" y1="300" x2="305" y2="270" stroke="#86efac" strokeWidth="1.5" strokeDasharray="4 3" />

      {/* ── Badge 1: Aplicativos (topo esquerdo) ── */}
      <rect x="70" y="88" width="74" height="60" rx="16" fill="white" filter="url(#sombra-badge)" />
      <rect x="82" y="100" width="50" height="36" rx="8" fill="#f0fdf4" />
      {/* Ícone de app grid */}
      <rect x="90" y="108" width="10" height="10" rx="2" fill="#16a34a" />
      <rect x="104" y="108" width="10" height="10" rx="2" fill="#16a34a" />
      <rect x="118" y="108" width="10" height="10" rx="2" fill="#16a34a" />
      <rect x="90" y="122" width="10" height="10" rx="2" fill="#bbf7d0" />
      <rect x="104" y="122" width="10" height="10" rx="2" fill="#bbf7d0" />
      <rect x="118" y="122" width="10" height="10" rx="2" fill="#bbf7d0" />

      {/* ── Badge 2: WhatsApp (topo direito) ── */}
      <rect x="336" y="98" width="74" height="64" rx="16" fill="white" filter="url(#sombra-badge)" />
      {/* Ícone WhatsApp simplificado */}
      <circle cx="373" cy="124" r="20" fill="#25D366" />
      <path d="M373 108 C363 108 355 116 355 126 C355 130 356 133 358 136 L355 144 L363 141 C366 143 369 144 373 144 C383 144 391 136 391 126 C391 116 383 108 373 108Z" fill="white" fillOpacity="0.25"/>
      <path d="M366 120 C366 120 365 122 367 125 C369 128 372 131 375 132 C378 133 380 132 380 132 L381 129 L378 128 L377 130 C377 130 374 129 372 127 C370 125 369 122 369 122 L371 121 L370 118 Z" fill="white" />

      {/* ── Badge 3: IA (baixo esquerdo) ── */}
      <rect x="62" y="268" width="74" height="64" rx="16" fill="white" filter="url(#sombra-badge)" />
      {/* Ícone estrela/IA */}
      <circle cx="99" cy="296" r="20" fill="#f0fdf4" />
      {/* Estrela de 4 pontas — símbolo IA */}
      <polygon points="99,278 102,292 116,296 102,300 99,314 96,300 82,296 96,292" fill="#16a34a" />
      <polygon points="99,284 101,292 109,296 101,300 99,308 97,300 89,296 97,292" fill="white" />

      {/* ── Badge 4: Monitoramento (baixo direito) ── */}
      <rect x="344" y="270" width="74" height="64" rx="16" fill="white" filter="url(#sombra-badge)" />
      {/* Ícone de gráfico/analytics */}
      <circle cx="381" cy="300" r="20" fill="#f0fdf4" />
      {/* Barras de gráfico */}
      <rect x="368" y="310" width="7" height="8" rx="2" fill="#bbf7d0" />
      <rect x="378" y="304" width="7" height="14" rx="2" fill="#4ade80" />
      <rect x="388" y="295" width="7" height="23" rx="2" fill="#16a34a" />
      {/* Linha de tendência */}
      <polyline points="371,308 381,300 391,291" fill="none" stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Seção Hero da Landing Page — Natural Tecnologia
 *
 * Responsabilidades:
 * - Apresentar o título e proposta de valor da empresa
 * - Exibir pílulas com os 4 serviços oferecidos
 * - Direcionar o visitante via CTAs para serviços (#servicos) e contato (#contato)
 * - Exibir ilustração SVG representando os serviços de tecnologia
 * - Layout responsivo: coluna única em mobile, 2 colunas em desktop
 *
 * @returns {JSX.Element}
 *
 * @example
 * <HeroSection />
 */
function HeroSection() {
  const servicos = [
    {
      texto: 'Aplicativos Personalizados',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      texto: 'Automação de WhatsApp',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
    {
      texto: 'Geração de Imagens e Vídeos com IA',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      texto: 'Monitoramento de Redes Sociais',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="servicos"
      aria-label="Apresentação — Natural Tecnologia"
      className="relative overflow-hidden bg-gradient-to-br from-white via-green-50 to-emerald-50 py-16 sm:py-24"
    >
      {/* Elemento decorativo de fundo — círculo grande */}
      <div
        aria-hidden="true"
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-green-100 opacity-40 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-emerald-100 opacity-40 blur-3xl pointer-events-none"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Coluna de texto ── */}
          <div className="flex flex-col gap-6">

            {/* Badge de destaque */}
            <span className="inline-flex self-start items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Tecnologia para o seu negócio
            </span>

            {/* Título principal */}
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
              Seu negócio{' '}
              <span className="text-green-600">mais inteligente</span>{' '}
              com tecnologia de verdade
            </h1>

            {/* Subtítulo */}
            <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
              Na <strong className="text-gray-800">Natural Tecnologia</strong> desenvolvemos aplicativos,
              automatizamos o atendimento no WhatsApp e criamos conteúdo com IA — para que você
              venda mais e trabalhe menos.
            </p>

            {/* Pílulas de serviços */}
            <ul className="flex flex-wrap gap-2" aria-label="Nossos serviços">
              {servicos.map((servico) => (
                <ServicoPilula key={servico.texto} icon={servico.icon} texto={servico.texto} />
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="#servicos"
                className="inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold px-7 py-3.5 rounded-full hover:bg-green-700 active:bg-green-800 transition-colors duration-200 shadow-md shadow-green-200"
              >
                Conheça nossos serviços
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </a>
              <a
                href="#contato"
                className="inline-flex items-center justify-center gap-2 border-2 border-green-600 text-green-700 font-semibold px-7 py-3.5 rounded-full hover:bg-green-50 active:bg-green-100 transition-colors duration-200"
              >
                Fale Conosco
              </a>
            </div>

          </div>

          {/* ── Coluna de ilustração ── */}
          <div className="flex items-center justify-center lg:justify-end">
            <IlustracaoTech />
          </div>

        </div>
      </div>
    </section>
  );
}

export default HeroSection;
