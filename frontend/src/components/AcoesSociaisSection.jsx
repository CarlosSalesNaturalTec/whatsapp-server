/**
 * Arquivo: frontend/src/components/AcoesSociaisSection.jsx
 * Descrição: Seção de Ações Sociais — Robô Educa e Inova Comunidade
 * Criado em: 2026-03-09
 */

/**
 * Botão de call to action principal
 */
function BotaoCTA({ href, variante = 'primario', children }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-full transition-colors duration-200 text-sm';
  const estilos = {
    primario: 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-200',
    secundario: 'border-2 border-green-600 text-green-700 hover:bg-green-50',
    laranja: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-200',
    roxo: 'bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-200',
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${base} ${estilos[variante]}`}>
      {children}
    </a>
  );
}

/**
 * Ícone de coração — doações
 */
function IconeCoracao() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
    </svg>
  );
}

/**
 * Ícone de robot
 */
function IconeRobo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H7a2 2 0 00-2 2v2m10-4h2a2 2 0 012 2v2M9 3V1m6 2V1M3 9h18M3 15h18M9 21H7a2 2 0 01-2-2v-2m10 4h2a2 2 0 002-2v-2M9 21v2m6-2v2M9 9h.01M15 9h.01M9 15h.01M15 15h.01" />
    </svg>
  );
}

/**
 * Bloco de pix com chave copiável
 */
function BlocoPix({ chave }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Chave PIX (CNPJ)</span>
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        <span className="font-mono text-sm text-green-800 font-semibold">{chave}</span>
      </div>
    </div>
  );
}

/**
 * Card de ação social — inclui fotos do Google Photos, descrição e CTAs
 *
 * @param {object}   props
 * @param {string}   props.id           - ID da âncora HTML
 * @param {string}   props.titulo       - Nome da iniciativa
 * @param {string}   props.descricao    - Texto de apresentação
 * @param {string}   props.albumUrl     - URL do álbum no Google Photos
 * @param {string}   props.corFundo     - Classe Tailwind para cor de fundo do card de album
 * @param {JSX.Element} props.icone     - Ícone do card
 * @param {JSX.Element} props.ctas      - Área de call to actions específica
 * @param {string[]} [props.destaques]  - Lista de destaques da iniciativa
 * @returns {JSX.Element}
 */
function CardAcaoSocial({ id, titulo, descricao, albumUrl, corFundo, icone, ctas, destaques }) {
  return (
    <div id={id} className={`scroll-mt-20 rounded-2xl overflow-hidden shadow-lg border border-gray-100`}>
      {/* Faixa de topo */}
      <div className={`${corFundo} px-6 py-5 flex items-center gap-3`}>
        <span className="text-white">{icone}</span>
        <h3 className="text-xl font-bold text-white">{titulo}</h3>
      </div>

      <div className="bg-white p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Coluna: texto + CTAs */}
          <div className="flex flex-col gap-5">
            <p className="text-gray-600 leading-relaxed">{descricao}</p>

            {destaques && (
              <ul className="space-y-2">
                {destaques.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {d}
                  </li>
                ))}
              </ul>
            )}

            {/* CTAs específicos de cada iniciativa */}
            {ctas}
          </div>

          {/* Coluna: galeria de fotos (link para Google Photos) */}
          <div className="flex flex-col gap-4">
            <a
              href={albumUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl overflow-hidden border-2 border-dashed border-gray-200 hover:border-green-400 transition-colors duration-200"
              aria-label={`Ver álbum de fotos — ${titulo}`}
            >
              {/* Preview decorativo do álbum */}
              <div className={`${corFundo} opacity-90 p-8 flex flex-col items-center gap-4 text-white`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="text-center">
                  <p className="font-bold text-lg">Álbum de Fotos</p>
                  <p className="text-sm opacity-80 mt-1">Clique para ver as fotos das nossas oficinas</p>
                </div>
                <span className="mt-1 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors duration-200 group-hover:bg-white/40">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ver no Google Fotos
                </span>
              </div>
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}

/**
 * Seção de Ações Sociais da Landing Page
 *
 * @returns {JSX.Element}
 */
function AcoesSociaisSection() {
  return (
    <section
      id="acoes-sociais"
      aria-label="Ações Sociais"
      className="py-16 sm:py-24 bg-gradient-to-br from-green-50 to-emerald-50"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Cabeçalho da seção */}
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full mb-4">
            <IconeCoracao />
            Impacto Social
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            Tecnologia que <span className="text-green-600">transforma vidas</span>
          </h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            Além de soluções para empresas, a Natural Tecnologia apoia iniciativas que levam educação e inovação às comunidades que mais precisam.
          </p>
        </div>

        {/* Cards das ações sociais */}
        <div className="flex flex-col gap-10">

          {/* Robô Educa */}
          <CardAcaoSocial
            id="robo-educa"
            titulo="Robô Educa"
            corFundo="bg-emerald-600"
            albumUrl="https://photos.app.goo.gl/yJiewdTTsNFtmF846"
            icone={<IconeRobo />}
            descricao="Plataforma inovadora que ensina programação para crianças de 6 a 14 anos, promovendo inclusão e sustentabilidade. As crianças montam seu próprio robô humanoide com materiais reciclados e interagem com ele via Inteligência Artificial (Google Gemini). Desde 2018, já impactou centenas de crianças em comunidades carentes de Salvador, Bahia."
            destaques={[
              'Ensino de programação e robótica para crianças de 6 a 14 anos',
              'Robô montado com materiais reciclados (PET) ou kits em MDF',
              'Interação por voz com IA (Google Gemini) — acessível para deficientes visuais',
              'Oficinas gratuitas em comunidades carentes de Salvador, Bahia',
              'Mais de 6 anos de impacto social desde 2018',
            ]}
            ctas={
              <div className="flex flex-col gap-4">
                {/* Doação PIX */}
                <div className="bg-green-50 rounded-xl border border-green-100 p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <IconeCoracao />
                    Apoie com uma doação via PIX
                  </p>
                  <p className="text-xs text-gray-500">Sua contribuição financia oficinas gratuitas de robótica em comunidades carentes.</p>
                  <BlocoPix chave="51.730.395/0001-19" />
                </div>

                {/* Kit robótico */}
                <div className="bg-orange-50 rounded-xl border border-orange-100 p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-gray-800">
                    Compre um Kit Robótico
                  </p>
                  <p className="text-xs text-gray-500">
                    Parte da arrecadação com a venda dos kits é revertida em oficinas gratuitas para crianças de comunidades carentes.
                  </p>
                  <BotaoCTA href="https://produto.mercadolivre.com.br/MLB-4485131991-kit-de-robotica-programaco-e-inteligncia-artificial-ia-_JM" variante="laranja">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Comprar Kit no Mercado Livre
                  </BotaoCTA>
                </div>
              </div>
            }
          />

          {/* Inova Comunidade */}
          <CardAcaoSocial
            id="inova-comunidade"
            titulo="Inova Comunidade"
            corFundo="bg-blue-600"
            albumUrl="https://photos.app.goo.gl/1nXWMwBcur4wQXxM8"
            icone={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            descricao="Iniciativa de inclusão digital e inovação que leva tecnologia, conhecimento e oportunidades para jovens e adultos em comunidades periféricas. Por meio de workshops, palestras e projetos práticos, conectamos pessoas ao mundo digital e ao mercado de trabalho em tecnologia."
            destaques={[
              'Workshops e palestras de tecnologia em comunidades periféricas',
              'Capacitação digital para jovens e adultos',
              'Conexão com oportunidades no mercado de tecnologia',
              'Fomento ao empreendedorismo digital local',
            ]}
            ctas={
              <div className="flex flex-col gap-3">
                <BotaoCTA href="https://photos.app.goo.gl/1nXWMwBcur4wQXxM8" variante="roxo">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Ver álbum de fotos
                </BotaoCTA>
                <BotaoCTA href="#contato" variante="secundario">
                  Quero apoiar esta iniciativa
                </BotaoCTA>
              </div>
            }
          />

        </div>
      </div>
    </section>
  );
}

export default AcoesSociaisSection;
