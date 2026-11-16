import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  RotateCw,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Bot,
  Hand,
  SearchCheck,
  ShieldCheck,
  Play,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  formatTime,
  formatDateBrazilian,
  PortalFlowMode,
  AutoVisibility,
} from '../utils/punch-rules';

interface PortalInteractiveModalProps {
  isOpen: boolean;
  usuario: string;
  senha: string;
  mode: PortalFlowMode;
  autoVisibility?: AutoVisibility;
  onChangeMode?: (nextMode: PortalFlowMode) => void;
  onChangeAutoVisibility?: (next: AutoVisibility) => void;
  onConfirmPunchFromX: (
    recordedDate: Date,
    options?: { isAuto?: boolean; portalPunches?: string[] }
  ) => void;
  onSyncPunchesFromPortal?: (portalPunches: string[]) => void;
  onCloseWithoutSaving: () => void;
}

type AutoStep =
  | 'starting'
  | 'login'
  | 'autoatendimento'
  | 'finding_punch_button'
  | 'clicking_punch_button'
  | 'finding_confirm_sim'
  | 'clicking_confirm_sim'
  | 'waiting_portal_confirmation'
  | 'reading_punches'
  | 'testing_connection'
  | 'done'
  | 'error';

export const PortalInteractiveModal: React.FC<PortalInteractiveModalProps> = ({
  isOpen,
  usuario,
  senha,
  mode,
  autoVisibility = 'visible',
  onChangeMode,
  onChangeAutoVisibility,
  onConfirmPunchFromX,
  onSyncPunchesFromPortal,
  onCloseWithoutSaving,
}) => {
  const [currentLiveDate, setCurrentLiveDate] = useState<Date>(new Date());
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [portalStage, setPortalStage] = useState<'starting' | 'login' | 'autoatendimento' | 'error'>('starting');
  const [autoStep, setAutoStep] = useState<AutoStep>('starting');
  const [portalErrorMsg, setPortalErrorMsg] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [completionInfo, setCompletionInfo] = useState<{
    success: boolean;
    message: string;
    punches?: string[];
  } | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(
    mode === 'auto_punch' && autoVisibility === 'background'
  );

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const completedRef = useRef(false);

  const cleanUser = usuario.trim();
  const cleanPass = senha.trim();
  const directPortalUrl =
    'https://pernambucanas.lgcloud.com.br/autenticacao/produtos/SAAA/principal2.aspx?c=pernambucanas';

  const initPortalSession = useCallback(
    async (overrideMode?: PortalFlowMode) => {
      if (!cleanUser || !cleanPass) return;
      const effectiveMode = overrideMode || mode;
      completedRef.current = false;
      setIsIframeLoading(true);
      setPortalStage('starting');
      setAutoStep('starting');
      setPortalErrorMsg(null);
      setRetryCountdown(0);
      setCompletionInfo(null);
      setIframeSrc('');

      try {
        const res = await fetch('/api/portal/start-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario: cleanUser, senha: cleanPass, mode: effectiveMode }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.loginUrl) {
          setPortalStage('login');
          setAutoStep('login');
          setIframeSrc(data.loginUrl);
        } else {
          setPortalStage('error');
          setAutoStep('error');
          setPortalErrorMsg(data.error || 'Falha ao iniciar sessão do portal.');
          setIsIframeLoading(false);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setPortalStage('error');
        setAutoStep('error');
        setPortalErrorMsg(msg);
        setIsIframeLoading(false);
      }
    },
    [cleanUser, cleanPass, mode]
  );

  // Start proxy session when modal opens (or when mode changes between verify/test/punch while open)
  useEffect(() => {
    if (!isOpen) {
      completedRef.current = false;
      return;
    }
    setIsMinimized(mode === 'auto_punch' && autoVisibility === 'background');
    initPortalSession(mode);
  }, [isOpen, mode, autoVisibility, initPortalSession]);

  // Live clock updating every second
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentLiveDate(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Listen to bridge messages from the proxied portal iframe
  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'PF_PORTAL_STAGE') {
        const path = String(data.path || '');
        const host = String(data.host || '');
        try {
          iframeRef.current?.contentWindow?.postMessage({ type: 'PF_SET_MODE', mode }, '*');
        } catch {
          // ignore
        }
        if (host.includes('pnb-prd-aa') || path.toLowerCase().includes('/autoatendimento')) {
          setPortalStage('autoatendimento');
          setPortalErrorMsg(null);
          setRetryCountdown(0);
        } else if (host.includes('pernambucanas') || path.toLowerCase().includes('/autenticacao')) {
          setPortalStage('login');
          setAutoStep('login');
        }
      } else if (data.type === 'PF_PORTAL_ERROR') {
        setPortalStage('error');
        setAutoStep('error');
        setPortalErrorMsg(String(data.message || 'Login ou senha inválidos no portal.'));
        setRetryCountdown(Number(data.retryingInSeconds || 0));
        setIsIframeLoading(false);
      } else if (data.type === 'PF_AUTO_STEP') {
        if (data.step) {
          setAutoStep(data.step as AutoStep);
        }
      } else if (data.type === 'PF_PORTAL_PUNCHES_SYNC') {
        if (Array.isArray(data.punches) && onSyncPunchesFromPortal) {
          onSyncPunchesFromPortal(data.punches);
        }
      } else if (data.type === 'PF_AUTO_PUNCH_RESULT') {
        if (completedRef.current) return;
        if (data.success) {
          completedRef.current = true;
          const synced = Array.isArray(data.punches) ? (data.punches as string[]) : [];
          setAutoStep('done');
          setCompletionInfo({
            success: true,
            message: 'Ponto batido e confirmado automaticamente no Portal Nossa Gente!',
            punches: synced,
          });
          const punchNow = new Date();
          setTimeout(() => {
            onConfirmPunchFromX(punchNow, { isAuto: true, portalPunches: synced });
          }, 900);
        } else {
          setPortalStage('error');
          setAutoStep('error');
          setPortalErrorMsg(
            String(data.error || 'Não foi possível concluir a batida automática. Tente novamente ou use o botão (✕).')
          );
          setCompletionInfo({
            success: false,
            message: String(data.error || 'Erro ao bater ponto automaticamente.'),
          });
        }
      } else if (data.type === 'PF_VERIFY_PUNCHES_RESULT') {
        if (completedRef.current) return;
        completedRef.current = true;
        if (data.success) {
          const synced = Array.isArray(data.punches) ? (data.punches as string[]) : [];
          if (onSyncPunchesFromPortal) {
            onSyncPunchesFromPortal(synced);
          }
          setAutoStep('done');
          setCompletionInfo({
            success: true,
            punches: synced,
            message:
              synced.length > 0
                ? `Verificação concluída! ${synced.length} batida(s) encontrada(s) hoje no portal: ${synced.join(', ')}.`
                : 'Verificação concluída no portal oficial: nenhuma batida registrada hoje ainda.',
          });
          setTimeout(() => {
            onCloseWithoutSaving();
          }, 1800);
        } else {
          setPortalStage('error');
          setAutoStep('error');
          setPortalErrorMsg(String(data.error || 'Falha ao consultar marcações do dia no portal.'));
          setCompletionInfo({
            success: false,
            message: String(data.error || 'Falha ao consultar marcações do dia no portal.'),
          });
        }
      } else if (data.type === 'PF_TEST_CONNECTION_RESULT') {
        if (completedRef.current) return;
        completedRef.current = true;
        const synced = Array.isArray(data.punches) ? (data.punches as string[]) : [];
        if (data.success && synced.length > 0 && onSyncPunchesFromPortal) {
          onSyncPunchesFromPortal(synced);
        }
        if (data.success) {
          setAutoStep('done');
          setCompletionInfo({
            success: true,
            punches: synced,
            message: data.isento
              ? 'Conexão 100% validada! Login aprovado e Autoatendimento carregado (usuário configurado como isento de ponto).'
              : 'Teste 100% aprovado! Login concluído, Autoatendimento carregado e botão "Marcar ponto" encontrado e ativo (ponto não batido).',
          });
        } else {
          setPortalStage('error');
          setAutoStep('error');
          setPortalErrorMsg(String(data.error || 'O teste não encontrou o botão Marcar ponto no portal.'));
          setCompletionInfo({
            success: false,
            message: String(data.error || 'Falha no teste de conexão.'),
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, mode, onConfirmPunchFromX, onSyncPunchesFromPortal, onCloseWithoutSaving]);

  // Live countdown ticker when waiting 5s to click Entrar again on error
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setTimeout(() => {
      setRetryCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [retryCountdown]);

  if (!isOpen) return null;

  const liveTimeStr = formatTime(currentLiveDate);
  const liveDateStr = formatDateBrazilian(currentLiveDate);
  const isPunchFlow = mode === 'auto_punch' || mode === 'manual_punch';

  const handleCopyUser = () => {
    navigator.clipboard.writeText(cleanUser);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 2000);
  };

  const handleCopyPass = () => {
    navigator.clipboard.writeText(cleanPass);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleXClick = () => {
    const punchMoment = new Date();
    onConfirmPunchFromX(punchMoment, { isAuto: false });
  };

  const handleOpenDirectChrome = () => {
    window.open(directPortalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSwitchPunchMode = (next: 'auto_punch' | 'manual_punch') => {
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: 'PF_SET_MODE', mode: next }, '*');
    } catch {
      // ignore
    }
    if (onChangeMode) {
      onChangeMode(next);
    }
  };

  const renderStatusText = () => {
    if (completionInfo) {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          {completionInfo.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span className="font-semibold">{completionInfo.message}</span>
          {mode === 'test_connection' && completionInfo.success && onChangeMode && (
            <button
              type="button"
              onClick={() => onChangeMode('auto_punch')}
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-[11px] rounded-md transition cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Bater Ponto Agora (Automático)</span>
            </button>
          )}
        </div>
      );
    }

    if (portalStage === 'error') {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>
            <strong>Aviso do Portal:</strong> {portalErrorMsg || 'Verifique seu login e senha.'}
            {retryCountdown > 0 && (
              <span className="ml-2 text-yellow-300 font-bold">
                • Aguardando {retryCountdown}s para clicar em Entrar novamente...
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => initPortalSession(mode)}
            className="px-2.5 py-0.5 bg-red-500/30 hover:bg-red-500/50 text-red-100 rounded-md font-bold text-[11px] border border-red-400/40 transition cursor-pointer"
          >
            Nova Sessão / Tentar
          </button>
        </div>
      );
    }

    if (portalStage === 'autoatendimento') {
      if (mode === 'verify_punches') {
        return (
          <>
            <SearchCheck className="w-4 h-4 shrink-0 text-sky-400 animate-pulse" />
            <span>
              <strong>Logado no Autoatendimento!</strong> Lendo suas <strong>Marcações do dia</strong> no portal oficial (sem bater ponto)...
            </span>
          </>
        );
      }
      if (mode === 'test_connection') {
        return (
          <>
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 animate-pulse" />
            <span>
              <strong>Logado no Autoatendimento!</strong> Verificando se o botão <strong>"Marcar ponto"</strong> está visível e ativo (Dry-Run)...
            </span>
          </>
        );
      }
      if (mode === 'auto_punch') {
        const stepLabel =
          autoStep === 'clicking_punch_button'
            ? 'Botão "Marcar ponto" clicado! Aguardando confirmação "Sim"...'
            : autoStep === 'finding_confirm_sim'
              ? 'Procurando botão de confirmação "Sim"...'
              : autoStep === 'clicking_confirm_sim' || autoStep === 'waiting_portal_confirmation'
                ? 'Botão "Sim" clicado! Aguardando confirmação oficial da batida...'
                : 'Procurando botão "Marcar ponto" na tela do Autoatendimento...';

        return (
          <>
            <Bot className="w-4 h-4 shrink-0 text-yellow-400 animate-pulse" />
            <span>
              <strong>Modo Automático:</strong> {stepLabel}
            </span>
          </>
        );
      }
      return (
        <>
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>
            <strong>Logado no Autoatendimento!</strong> Bata seu ponto manualmente na tela abaixo e depois toque no botão <strong>(✕)</strong> no canto para salvar o horário!
          </span>
        </>
      );
    }

    return (
      <>
        <Sparkles className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
        <span>
          {mode === 'auto_punch' && (
            <>
              <strong>Automático:</strong> Entrando no portal • Aguarda 5s se erro • Clica em <strong>Marcar ponto</strong> e confirma <strong>Sim</strong>!
            </>
          )}
          {mode === 'manual_punch' && (
            <>
              <strong>Manual:</strong> Logando com seu CPF e senha • Bata o ponto no Autoatendimento • Toque no <strong>(✕)</strong> para salvar!
            </>
          )}
          {mode === 'verify_punches' && (
            <>
              <strong>Verificar Pontos:</strong> Logando automaticamente (aguarda 5s se erro) para consultar suas marcações reais de hoje...
            </>
          )}
          {mode === 'test_connection' && (
            <>
              <strong>Teste ao Vivo:</strong> Logando automaticamente (aguarda 5s se erro) e validando o botão <strong>Marcar ponto</strong> sem bater ponto!
            </>
          )}
        </span>
      </>
    );
  };

  const showBackgroundCard = isMinimized && mode === 'auto_punch';

  const backgroundSteps = [
    {
      id: 'login',
      label: 'Conectando e preenchendo CPF/Senha no portal',
      active: autoStep === 'starting' || autoStep === 'login',
      done: portalStage === 'autoatendimento' || autoStep === 'done',
    },
    {
      id: 'aa',
      label: 'Acessando Autoatendimento (Nossa Gente)',
      active: autoStep === 'autoatendimento' || autoStep === 'finding_punch_button',
      done:
        autoStep === 'clicking_punch_button' ||
        autoStep === 'finding_confirm_sim' ||
        autoStep === 'clicking_confirm_sim' ||
        autoStep === 'waiting_portal_confirmation' ||
        autoStep === 'done',
    },
    {
      id: 'punch',
      label: 'Clicando em "Marcar ponto" e confirmando "Sim"',
      active:
        autoStep === 'clicking_punch_button' ||
        autoStep === 'finding_confirm_sim' ||
        autoStep === 'clicking_confirm_sim' ||
        autoStep === 'waiting_portal_confirmation',
      done: autoStep === 'done',
    },
  ];

  const handleToggleVisibility = (hidden: boolean) => {
    setIsMinimized(hidden);
    onChangeAutoVisibility?.(hidden ? 'background' : 'visible');
  };

  return (
    <>
      {/* ── COMPACT BACKGROUND AUTOMATION OVERLAY (QUANDO ESCOLHIDO "SEM VER") ── */}
      {showBackgroundCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md pf-surface border-2 pf-border-accent rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl pf-btn-accent flex items-center justify-center shrink-0">
                  {completionInfo?.success ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : portalStage === 'error' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <Bot className="w-6 h-6 animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">
                    {completionInfo?.success
                      ? 'Ponto Registrado!'
                      : portalStage === 'error'
                        ? 'Aguardando Portal'
                        : 'Batendo Ponto em Segundo Plano'}
                  </h3>
                  <p className="text-xs pf-text-muted">
                    Execução automática discreta • {liveTimeStr}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggleVisibility(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold pf-surface-muted border pf-border hover:opacity-90 transition cursor-pointer shrink-0"
                title="Abrir visualização ao vivo do portal"
              >
                <Eye className="w-3.5 h-3.5 pf-text-accent" />
                <span>Ver Tela</span>
              </button>
            </div>

            {/* Step pipeline */}
            <div className="space-y-2.5">
              {backgroundSteps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs transition ${
                    step.done
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300 font-semibold'
                      : step.active
                        ? 'pf-bg-accent-soft pf-border-accent font-bold'
                        : 'pf-surface-muted pf-border pf-text-muted opacity-70'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black">
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : step.active ? (
                      <RotateCw className="w-4 h-4 pf-text-accent animate-spin" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>

            {portalStage === 'error' && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300 space-y-2">
                <div className="font-semibold">
                  {portalErrorMsg || 'Aviso durante login no portal.'}
                </div>
                {retryCountdown > 0 && (
                  <div className="font-bold">
                    Tentando novamente em {retryCountdown}s automaticamente...
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleToggleVisibility(false)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold pf-btn-accent cursor-pointer"
                  >
                    Abrir Tela para Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => initPortalSession(mode)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold pf-surface border pf-border cursor-pointer"
                  >
                    Reiniciar Tentativa
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t pf-border">
              <button
                type="button"
                onClick={onCloseWithoutSaving}
                className="text-xs font-semibold pf-text-muted hover:opacity-80 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleXClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold pf-btn-accent cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Confirmar Manual (✕)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL COMPLETO (OU IFRAME INVISÍVEL EM SEGUNDO PLANO) ────────── */}
      <div
        className={
          showBackgroundCard
            ? 'fixed -left-[9999px] top-0 w-[1024px] h-[768px] opacity-0 pointer-events-none overflow-hidden'
            : 'fixed inset-0 z-50 flex flex-col pf-canvas animate-in fade-in duration-200 overflow-hidden'
        }
      >
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header className="pf-surface border-b pf-border px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-lg relative z-20 shrink-0 gap-2">
        {/* Left Side: Brand + Live Clock */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <span className="pf-btn-accent text-[10px] font-black px-1.5 py-0.5 rounded tracking-tighter uppercase">
              GRUPO
            </span>
            <span className="font-extrabold text-sm sm:text-base tracking-tight hidden sm:inline">
              pernambucanas
            </span>
          </div>

          <div className="h-5 w-px bg-neutral-300 dark:bg-neutral-800 hidden sm:block" />

          {/* Live digital clock */}
          <div className="flex items-center gap-1.5 pf-surface-muted px-2.5 py-1 rounded-lg border pf-border">
            <Clock className="w-3.5 h-3.5 pf-text-accent" />
            <span className="font-mono font-bold text-xs sm:text-sm pf-text-accent">
              {liveTimeStr}
            </span>
          </div>

          <span className="text-[11px] pf-text-muted hidden md:inline truncate max-w-[200px]">
            {liveDateStr}
          </span>
        </div>

        {/* Center: Mode switcher (for punch flow) + Quick Helpers */}
        <div className="hidden lg:flex items-center gap-2">
          {isPunchFlow && onChangeMode && (
            <div className="flex items-center pf-surface-muted p-0.5 rounded-lg border pf-border mr-1">
              <button
                type="button"
                onClick={() => handleSwitchPunchMode('auto_punch')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  mode === 'auto_punch'
                    ? 'pf-btn-accent'
                    : 'pf-text-muted hover:opacity-80'
                }`}
              >
                <Bot className="w-3 h-3" />
                <span>Automático</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchPunchMode('manual_punch')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  mode === 'manual_punch'
                    ? 'pf-btn-accent'
                    : 'pf-text-muted hover:opacity-80'
                }`}
              >
                <Hand className="w-3 h-3" />
                <span>Manual (✕)</span>
              </button>
            </div>
          )}

          {mode === 'auto_punch' && (
            <button
              type="button"
              onClick={() => handleToggleVisibility(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 pf-surface-muted hover:opacity-90 rounded-lg text-xs font-semibold border pf-border transition cursor-pointer"
              title="Minimizar e continuar batendo o ponto em segundo plano (sem ver)"
            >
              <EyeOff className="w-3.5 h-3.5 pf-text-accent" />
              <span>Segundo Plano</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyUser}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-semibold text-neutral-300 border border-neutral-700 transition cursor-pointer"
            title="Copiar seu CPF para colar se necessário"
          >
            {copiedUser ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUser ? 'CPF Copiado!' : 'Copiar CPF'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPass}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-semibold text-neutral-300 border border-neutral-700 transition cursor-pointer"
            title="Copiar sua senha para colar se necessário"
          >
            {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <KeyRound className="w-3.5 h-3.5" />}
            <span>{copiedPass ? 'Senha Copiada!' : 'Copiar Senha'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenDirectChrome}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-semibold text-sky-300 border border-neutral-700 transition cursor-pointer"
            title="Abrir página oficial do portal diretamente no Google Chrome"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir no Chrome</span>
          </button>

          <button
            type="button"
            onClick={() => initPortalSession(mode)}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white transition cursor-pointer"
            title="Recarregar tela do portal e tentar novamente"
            aria-label="Recarregar tela do portal"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Corner: (✕) Button in punch modes, Fechar in verify/test modes */}
        <div className="flex items-center gap-2">
          {isPunchFlow ? (
            <>
              <button
                type="button"
                onClick={onCloseWithoutSaving}
                className="text-[11px] text-neutral-400 hover:text-neutral-200 px-2 py-1 transition cursor-pointer hidden sm:block"
              >
                Voltar sem salvar
              </button>

              <button
                type="button"
                onClick={handleXClick}
                aria-label="Salvar ponto no horário atual e voltar para o aplicativo (✕)"
                className={`flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 pf-btn-accent font-black text-xs sm:text-sm rounded-xl active:scale-95 transition cursor-pointer border pf-border-accent-solid ${
                  portalStage === 'autoatendimento' ? 'ring-2 ring-emerald-400 ring-offset-2' : ''
                }`}
                title="Clique no ✕ para gravar o horário atual no app caso deseje concluir manualmente"
              >
                <div className="w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center font-black text-xs shrink-0">
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span className="tracking-tight">
                  <span className="hidden xs:inline">CONCLUÍDO </span>(✕)
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onCloseWithoutSaving}
              className="flex items-center gap-1.5 px-4 py-2 pf-surface-muted hover:opacity-90 font-bold text-xs rounded-xl border pf-border transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Fechar</span>
            </button>
          )}
        </div>
      </header>

      {/* ── SUBHEADER DE STATUS AO VIVO ───────────────────────────────────── */}
      <div
        className={`border-b px-3 sm:px-6 py-2 flex items-center justify-between text-xs shrink-0 backdrop-blur gap-2 ${
          completionInfo?.success
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-200'
            : portalStage === 'autoatendimento'
              ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-700 dark:text-emerald-200'
              : portalStage === 'error'
                ? 'bg-red-500/12 border-red-500/30 text-red-700 dark:text-red-200'
                : 'pf-bg-accent-soft pf-border-accent pf-text-accent'
        }`}
      >
        <div className="flex items-center gap-2 text-[11px] sm:text-xs">{renderStatusText()}</div>

        {/* Mobile quick controls */}
        <div className="flex items-center gap-1.5 lg:hidden shrink-0">
          {mode === 'auto_punch' && (
            <button
              type="button"
              onClick={() => handleToggleVisibility(true)}
              className="px-2 py-0.5 pf-surface-muted pf-text-accent rounded text-[10px] font-bold border pf-border"
              title="Segundo plano"
            >
              Ocultar
            </button>
          )}
          {isPunchFlow && onChangeMode && (
            <button
              type="button"
              onClick={() => handleSwitchPunchMode(mode === 'auto_punch' ? 'manual_punch' : 'auto_punch')}
              className="px-2 py-0.5 pf-btn-accent rounded text-[10px] font-black"
            >
              {mode === 'auto_punch' ? 'Auto' : 'Manual'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyUser}
            className="px-2 py-0.5 pf-surface-muted rounded text-[10px] font-bold border pf-border"
          >
            {copiedUser ? '✓' : 'CPF'}
          </button>
          <button
            type="button"
            onClick={handleCopyPass}
            className="px-2 py-0.5 pf-surface-muted rounded text-[10px] font-bold border pf-border"
          >
            {copiedPass ? '✓' : 'Senha'}
          </button>
          <button
            type="button"
            onClick={() => initPortalSession(mode)}
            className="p-1 pf-surface-muted rounded border pf-border"
            aria-label="Recarregar portal"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── CORPO PRINCIPAL COM O PORTAL OFICIAL EMBARCADO ─────────────── */}
      <div className="flex-1 relative pf-surface-muted w-full h-full overflow-hidden">
        {isIframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pf-canvas/90 backdrop-blur-sm p-4 text-center">
            <div className="w-12 h-12 rounded-full border-4 pf-border border-t-[var(--pf-accent)] animate-spin mb-3" />
            <h4 className="font-bold text-sm">
              Abrindo Portal Oficial da Pernambucanas...
            </h4>
            <p className="text-xs pf-text-muted mt-1 max-w-sm">
              Preenchendo automaticamente CPF e senha e entrando no Autoatendimento...
            </p>
          </div>
        )}

        {iframeSrc && (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Portal Pernambucanas LG Cloud"
            className="w-full h-full border-0 bg-white"
            onLoad={() => {
              setIsIframeLoading(false);
              try {
                iframeRef.current?.contentWindow?.postMessage({ type: 'PF_SET_MODE', mode }, '*');
              } catch {
                // ignore
              }
            }}
            allow="geolocation; camera; clipboard-read; clipboard-write"
          />
        )}

        {/* ── BOTÃO FLUTUANTE ✕ NO CANTO INFERIOR (PUNCH MODES) ────────── */}
        {isPunchFlow && !showBackgroundCard && (
          <button
            type="button"
            onClick={handleXClick}
            aria-label="Salvar batida no horário exato e voltar ao app"
            className="fixed bottom-4 right-4 sm:bottom-7 sm:right-7 z-40 flex items-center gap-2 px-4 sm:px-5 py-3 pf-btn-accent font-black text-xs sm:text-sm rounded-full shadow-2xl border-2 border-black/80 active:scale-95 transition cursor-pointer"
            title="Clique aqui caso deseje salvar o horário manualmente e voltar ao app"
          >
            <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center font-black text-xs shrink-0">
              <X className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span className="font-bold">SALVAR BATIDA ({liveTimeStr})</span>
          </button>
        )}
      </div>
    </div>
    </>
  );
};
