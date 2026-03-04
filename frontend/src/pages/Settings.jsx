/**
 * Arquivo: frontend/src/pages/Settings.jsx
 * Descrição: Página de configurações — gerencia a conexão WhatsApp sob demanda.
 *
 * Estados da conexão e o que é exibido:
 *   disconnected     → formulário de número + botão "Solicitar Pairing Code"
 *   connecting       → spinner "Conectando..."
 *   awaiting_pairing → código em destaque + instruções passo a passo
 *   connected        → confirmação de sucesso + botão "Desconectar"
 *   error            → aviso de erro + formulário para nova tentativa
 *
 * Polling: GET /api/whatsapp/status a cada 2s para atualizar status e código.
 *
 * Criado em: 2026-03-03
 */

import { useState, useEffect } from 'react';
import Header from '../components/Header.jsx';
import Footer  from '../components/Footer.jsx';

// -----------------------------------------------------------------
// Configuração visual de cada estado
// -----------------------------------------------------------------

const STATUS_CONFIG = {
  disconnected: {
    label:      'DESCONECTADO',
    dotClass:   'bg-gray-400',
    badgeClass: 'bg-gray-100 text-gray-600',
    pulse:      false,
  },
  connecting: {
    label:      'CONECTANDO...',
    dotClass:   'bg-yellow-400',
    badgeClass: 'bg-yellow-50 text-yellow-700',
    pulse:      true,
  },
  awaiting_pairing: {
    label:      'AGUARDANDO PAREAMENTO',
    dotClass:   'bg-blue-400',
    badgeClass: 'bg-blue-50 text-blue-700',
    pulse:      true,
  },
  connected: {
    label:      'CONECTADO',
    dotClass:   'bg-green-500',
    badgeClass: 'bg-green-50 text-green-700',
    pulse:      false,
  },
  error: {
    label:      'ERRO DE CONEXÃO',
    dotClass:   'bg-red-500',
    badgeClass: 'bg-red-50 text-red-700',
    pulse:      false,
  },
};

// -----------------------------------------------------------------
// Componentes auxiliares
// -----------------------------------------------------------------

/**
 * Badge colorido que reflete o estado atual da conexão WhatsApp.
 *
 * @param {{ status: string }} props
 */
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-wide ${cfg.badgeClass}`}>
      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${cfg.dotClass} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

/**
 * Spinner SVG reutilizável.
 * @param {{ className?: string }} props
 */
function Spinner({ className = 'h-8 w-8 text-green-600' }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// -----------------------------------------------------------------
// Página principal
// -----------------------------------------------------------------

/**
 * Página de configurações da conexão WhatsApp.
 * Acessível em /configuracoes — sem autenticação (fase 1).
 *
 * @returns {JSX.Element}
 */
export default function Settings() {
  const [status,      setStatus]      = useState('disconnected');
  const [pairingCode, setPairingCode] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputError,  setInputError]  = useState('');

  // ---------------------------------------------------------------
  // Pré-preenche o número com o valor configurado na env (se houver)
  // ---------------------------------------------------------------
  useEffect(() => {
    fetch('/api/whatsapp/config')
      .then((r) => r.json())
      .then((data) => { if (data.phoneNumber) setPhoneNumber(data.phoneNumber); })
      .catch(() => {}); // campo fica em branco — usuário preenche manualmente
  }, []);

  // ---------------------------------------------------------------
  // Polling a cada 2s — atualiza status e pairing code
  // ---------------------------------------------------------------
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('/api/whatsapp/status');
        if (!r.ok) return;
        const data = await r.json();
        setStatus(data.status);
        setPairingCode(data.pairingCode ?? null);
      } catch {
        // falha de rede silenciosa — próximo ciclo tenta novamente
      }
    };

    poll(); // poll imediato ao montar
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------

  /** Valida o número e dispara a conexão via API */
  const handleConnect = async () => {
    setInputError('');

    if (!/^\d{10,15}$/.test(phoneNumber)) {
      setInputError('Informe apenas dígitos no formato E.164 sem + (ex: 5511999999999)');
      return;
    }

    setIsSubmitting(true);
    try {
      const r = await fetch('/api/whatsapp/connect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phoneNumber }),
      });

      if (!r.ok) {
        const data = await r.json();
        setInputError(data.error ?? 'Erro ao iniciar conexão. Tente novamente.');
      }
    } catch {
      setInputError('Erro de rede. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Desconecta a sessão ativa */
  const handleDisconnect = async () => {
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
    } catch {
      // status será corrigido pelo próximo ciclo de polling
    }
  };

  // Estados que permitem iniciar a conexão
  const canConnect  = status === 'disconnected' || status === 'error';

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Header />

      <main className="flex-1 pt-16" aria-label="Configurações do bot WhatsApp">
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">

            {/* Cabeçalho da página */}
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Configurações</h1>
              <p className="text-gray-500 text-sm">Gerencie a conexão do bot WhatsApp</p>
            </div>

            {/* Card principal */}
            <div className="border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

              {/* Header do card — status */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Status da Conexão
                </span>
                <StatusBadge status={status} />
              </div>

              {/* Corpo do card */}
              <div className="px-6 py-8">

                {/* ── DESCONECTADO / ERRO ── formulário */}
                {canConnect && (
                  <div className="space-y-6">

                    {status === 'error' && (
                      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Ocorreu um erro na conexão anterior. Verifique as configurações e tente novamente.</span>
                      </div>
                    )}

                    {/* Campo número */}
                    <div>
                      <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                        Número do WhatsApp
                      </label>
                      <input
                        id="phoneNumber"
                        type="tel"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={(e) => {
                          setPhoneNumber(e.target.value.replace(/\D/g, ''));
                          setInputError('');
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                        placeholder="5511999999999"
                        maxLength={15}
                        className={`w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400
                          focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                          transition-colors text-base font-mono tracking-wider
                          ${inputError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
                      />
                      {inputError ? (
                        <p className="mt-2 text-sm text-red-600">{inputError}</p>
                      ) : (
                        <p className="mt-2 text-xs text-gray-400">
                          Apenas dígitos com DDI, sem espaços ou traços (ex:{' '}
                          <span className="font-mono">5511999999999</span>)
                        </p>
                      )}
                    </div>

                    {/* Botão conectar */}
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={isSubmitting}
                      className="w-full bg-green-600 text-white py-3 px-6 rounded-full font-semibold text-sm
                        hover:bg-green-700 active:bg-green-800
                        disabled:opacity-60 disabled:cursor-not-allowed
                        transition-colors duration-200"
                    >
                      {isSubmitting ? 'Iniciando...' : 'Solicitar Pairing Code'}
                    </button>
                  </div>
                )}

                {/* ── CONECTANDO ── spinner */}
                {status === 'connecting' && (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <Spinner className="h-10 w-10 text-green-600" />
                    <p className="text-gray-500 text-sm">Conectando ao WhatsApp...</p>
                  </div>
                )}

                {/* ── AGUARDANDO PAREAMENTO ── código + instruções */}
                {status === 'awaiting_pairing' && (
                  <div className="space-y-8">

                    {/* Código em destaque */}
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-gray-500">Seu código de pareamento:</p>

                      {pairingCode ? (
                        <div className="bg-gray-50 border-2 border-dashed border-green-300 rounded-2xl px-8 py-6 text-center w-full max-w-xs">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-3">
                            Código
                          </p>
                          <p className="text-4xl font-mono font-bold text-gray-900 tracking-[0.25em]">
                            {pairingCode}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-gray-400 py-4">
                          <Spinner className="h-5 w-5 text-gray-400" />
                          <span className="text-sm">Gerando código...</span>
                        </div>
                      )}
                    </div>

                    {/* Instruções */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-4">Como vincular:</p>
                      <ol className="space-y-3">
                        {[
                          'Abra o WhatsApp no seu celular',
                          'Acesse Configurações → Dispositivos vinculados',
                          'Toque em "Vincular um dispositivo"',
                          'Selecione "Vincular com número de telefone"',
                          'Digite o código exibido acima',
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 text-green-700 font-bold text-xs flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}

                {/* ── CONECTADO ── sucesso + desconectar */}
                {status === 'connected' && (
                  <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 bg-green-50 border border-green-100 rounded-xl">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-green-800 text-sm">WhatsApp conectado com sucesso</p>
                        <p className="text-green-700 text-sm mt-1">
                          O bot está ativo e pronto para receber mensagens.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="w-full border border-gray-300 text-gray-600 py-3 px-6 rounded-full font-semibold text-sm
                        hover:border-red-300 hover:text-red-600 hover:bg-red-50
                        transition-colors duration-200"
                    >
                      Desconectar
                    </button>
                  </div>
                )}

              </div>
            </div>

            {/* Nota sobre autenticação futura */}
            <p className="mt-6 text-center text-xs text-gray-400">
              Acesso público temporário · Autenticação por login e senha será adicionada em breve.
            </p>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
