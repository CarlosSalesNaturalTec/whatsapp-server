/**
 * Arquivo: frontend/src/components/ProdutosSection.jsx
 * Descrição: Seção de Produtos da Landing Page com carrossel de screenshots
 * Criado em: 2026-03-09
 */

import { useState, useCallback } from 'react';

const SECRETARIA_SLIDES = [
  { src: '/images/secretaria/01_dashboard.png', caption: 'Dashboard Administrativo' },
  { src: '/images/secretaria/02_lanca_notas.png', caption: 'Lançamento de Notas' },
  { src: '/images/secretaria/03_documentos.png', caption: 'Gestão de Documentos' },
  { src: '/images/secretaria/04_solicitacoes.png', caption: 'Solicitações Acadêmicas' },
  { src: '/images/secretaria/05_dashboard_aluno.png', caption: 'Dashboard do Aluno' },
  { src: '/images/secretaria/06_grades.png', caption: 'Grades Curriculares' },
  { src: '/images/secretaria/07_documentos.png', caption: 'Documentos do Aluno' },
  { src: '/images/secretaria/08_solicitacoes.png', caption: 'Solicitações do Aluno' },
  { src: '/images/secretaria/09_dashboard_professor.png', caption: 'Dashboard do Professor' },
  { src: '/images/secretaria/10_turmas.png', caption: 'Gestão de Turmas' },
];

const IAREELS_SLIDES = [
  { src: '/images/iareels/01_dashboard.png', caption: 'Dashboard Principal' },
  { src: '/images/iareels/02_personas.png', caption: 'Personas Digitais com IA' },
  { src: '/images/iareels/03_campanhas.png', caption: 'Campanhas Publicitárias' },
];

/**
 * Carrossel de screenshots de produto
 *
 * @param {object}   props
 * @param {Array}    props.slides  - Array de { src, caption }
 * @param {string}   props.titulo - Título do produto (acessibilidade)
 * @returns {JSX.Element}
 */
function Carrossel({ slides, titulo }) {
  const [atual, setAtual] = useState(0);

  const anterior = useCallback(() =>
    setAtual((i) => (i === 0 ? slides.length - 1 : i - 1)), [slides.length]);

  const proximo = useCallback(() =>
    setAtual((i) => (i === slides.length - 1 ? 0 : i + 1)), [slides.length]);

  return (
    <div className="relative w-full" aria-label={`Carrossel de telas — ${titulo}`}>
      {/* Imagem principal */}
      <div className="overflow-hidden rounded-xl shadow-lg bg-gray-100 aspect-video flex items-center justify-center">
        <img
          key={atual}
          src={slides[atual].src}
          alt={`${titulo} — ${slides[atual].caption}`}
          className="w-full h-full object-contain transition-opacity duration-300"
        />
      </div>

      {/* Legenda */}
      <p className="text-center text-sm text-gray-500 mt-2 font-medium">
        {slides[atual].caption}
      </p>

      {/* Controles prev / next */}
      {slides.length > 1 && (
        <>
          <button
            onClick={anterior}
            aria-label="Imagem anterior"
            className="absolute top-1/2 left-2 -translate-y-1/2 bg-white/80 hover:bg-white shadow rounded-full p-2 transition-colors duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={proximo}
            aria-label="Próxima imagem"
            className="absolute top-1/2 right-2 -translate-y-1/2 bg-white/80 hover:bg-white shadow rounded-full p-2 transition-colors duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Indicadores de ponto */}
          <div className="flex justify-center gap-1.5 mt-3" role="tablist" aria-label="Slides">
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === atual}
                aria-label={`Ir para imagem ${i + 1}`}
                onClick={() => setAtual(i)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === atual ? 'bg-green-600 w-4' : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Card de produto com carrossel de screenshots e descrição
 *
 * @param {object}   props
 * @param {string}   props.id          - ID da âncora HTML
 * @param {string}   props.titulo      - Nome do produto
 * @param {string}   props.descricao   - Descrição principal
 * @param {string[]} props.funcionalidades - Lista de funcionalidades
 * @param {Array}    props.slides      - Slides do carrossel
 * @param {boolean}  [props.invertido] - Inverte a ordem coluna texto / carrossel
 * @param {JSX.Element} props.badge    - Badge/tag de categoria
 * @returns {JSX.Element}
 */
function ProdutoCard({ id, titulo, descricao, funcionalidades, slides, invertido, badge }) {
  return (
    <div id={id} className="scroll-mt-20">
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${invertido ? 'lg:grid-flow-dense' : ''}`}>

        {/* Coluna de texto */}
        <div className={`flex flex-col gap-5 ${invertido ? 'lg:col-start-2' : ''}`}>
          {badge}

          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">{titulo}</h3>
          <p className="text-gray-600 leading-relaxed">{descricao}</p>

          <ul className="space-y-2">
            {funcionalidades.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          <a
            href="#contato"
            className="self-start inline-flex items-center gap-2 bg-green-600 text-white font-semibold px-6 py-3 rounded-full hover:bg-green-700 transition-colors duration-200 shadow-md shadow-green-200 text-sm"
          >
            Quero saber mais
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>

        {/* Coluna do carrossel */}
        <div className={invertido ? 'lg:col-start-1 lg:row-start-1' : ''}>
          <Carrossel slides={slides} titulo={titulo} />
        </div>

      </div>
    </div>
  );
}

/**
 * Seção de Produtos da Landing Page
 *
 * @returns {JSX.Element}
 */
function ProdutosSection() {
  return (
    <section
      id="produtos"
      aria-label="Nossos Produtos"
      className="py-16 sm:py-24 bg-white"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Cabeçalho da seção */}
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            Soluções Desenvolvidas
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            Produtos que <span className="text-green-600">transformam</span> o seu negócio
          </h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            Aplicações desenvolvidas sob medida com foco em produtividade, automação e resultados reais.
          </p>
        </div>

        {/* Cards de produto */}
        <div className="flex flex-col gap-20">

          <ProdutoCard
            id="secretaria-online"
            titulo="Secretaria Online"
            descricao="Sistema de gestão acadêmica completo para instituições de ensino. Centraliza e digitaliza o gerenciamento de alunos, professores, cursos, matrículas, contratos e documentos acadêmicos em uma única plataforma acessível de qualquer dispositivo."
            funcionalidades={[
              'Módulo Administrativo: gestão de usuários, cursos, turmas e matrículas',
              'Módulo Aluno: consulta de notas, upload de documentos e solicitações acadêmicas',
              'Módulo Professor: gestão de turmas e lançamento de notas',
              'Controle de documentos e contratos digitais',
              'Relatórios e histórico acadêmico completo',
            ]}
            slides={SECRETARIA_SLIDES}
            badge={
              <span className="inline-flex self-start items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Gestão Acadêmica
              </span>
            }
          />

          <ProdutoCard
            id="iareels"
            titulo="IAReels"
            descricao="Plataforma SaaS que permite a empreendedores criar campanhas publicitárias em vídeo utilizando avatares digitais gerados por Inteligência Artificial. Reduza drasticamente o custo de produção e o tempo de lançamento das suas campanhas no mercado."
            funcionalidades={[
              'Avatares digitais criados com IA para vídeos publicitários',
              'Geração automatizada de conteúdo para Instagram e YouTube',
              'Criação de personas digitais personalizadas para sua marca',
              'Gestão de campanhas publicitárias em um só lugar',
              'Alta qualidade visual a uma fração do custo de produção tradicional',
            ]}
            slides={IAREELS_SLIDES}
            invertido
            badge={
              <span className="inline-flex self-start items-center gap-1.5 bg-purple-50 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                IA Generativa
              </span>
            }
          />

        </div>
      </div>
    </section>
  );
}

export default ProdutosSection;
