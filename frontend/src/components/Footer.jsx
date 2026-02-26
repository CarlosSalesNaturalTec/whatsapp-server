/**
 * Arquivo: frontend/src/components/Footer.jsx
 * Descrição: Rodapé da Landing Page com informações de contato da empresa
 * Feature: feat-025 - Implementar layout base da Landing Page
 * Criado em: 2026-02-26
 */

/** Ano atual calculado uma única vez no módulo (sem side-effects no render) */
const ANO_ATUAL = new Date().getFullYear();

/**
 * Item de contato com ícone SVG, rótulo e valor clicável
 *
 * @param {object}    props
 * @param {JSX.Element} props.icon  - Ícone SVG do item
 * @param {string}    props.label   - Rótulo acessível (ex: "Telefone")
 * @param {string}    props.href    - href do link (tel:, mailto:, https:)
 * @param {string}    props.texto   - Texto exibido ao usuário
 * @returns {JSX.Element}
 */
function ContatoItem({ icon, label, href, texto }) {
  return (
    <li className="flex items-center gap-3">
      <span className="text-green-400 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <a
        href={href}
        aria-label={`${label}: ${texto}`}
        className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
      >
        {texto}
      </a>
    </li>
  );
}

/**
 * Rodapé da Landing Page — Natural Tecnologia
 *
 * Responsabilidades:
 * - Exibir dados de contato da empresa (telefone, WhatsApp, e-mail)
 * - Exibir copyright com ano dinâmico
 * - Manter layout responsivo (mobile-first)
 *
 * @returns {JSX.Element}
 *
 * @example
 * <Footer />
 */
function Footer() {
  const contatoItens = [
    {
      label: 'Telefone',
      href:  'tel:+557132352803',
      texto: '(71) 3235-2803',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
    },
    {
      label: 'WhatsApp',
      href:  'https://wa.me/5571993416896',
      texto: '(71) 9.9341-6896',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
    },
    {
      label: 'E-mail',
      href:  'mailto:naturalbahia@gmail.com',
      texto: 'naturalbahia@gmail.com',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <footer id="contato" className="bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Coluna: Marca */}
          <div>
            <p className="text-green-400 font-bold text-xl tracking-tight mb-1">
              Natural <span className="text-white font-semibold">Tecnologia</span>
            </p>
            <p className="text-gray-400 text-sm mt-3 max-w-xs">
              Transformando ideias em soluções digitais inteligentes para o seu negócio.
            </p>
          </div>

          {/* Coluna: Contato */}
          <div>
            <h2 className="text-white font-semibold text-base mb-4">
              Entre em Contato
            </h2>
            <ul className="space-y-3" aria-label="Informações de contato">
              {contatoItens.map((item) => (
                <ContatoItem key={item.href} {...item} />
              ))}
            </ul>
          </div>

        </div>

        {/* Divisor e copyright */}
        <div className="border-t border-gray-800 mt-10 pt-6 text-center">
          <p className="text-gray-500 text-xs">
            &copy; {ANO_ATUAL} Natural Tecnologia. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
