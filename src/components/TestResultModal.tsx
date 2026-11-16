import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Camera,
  Terminal,
  X,
  Play,
  RotateCw,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Maximize2,
  UserCheck,
} from 'lucide-react';

interface ScreenshotItem {
  label: string;
  dataUrl: string;
  time?: string;
}

interface TestResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  progressMessage: string;
  result: {
    success: boolean;
    message?: string;
    error?: string;
    isDryRun?: boolean;
    buttonFound?: boolean;
    screenshot?: string;
    screenshots?: ScreenshotItem[];
    logs?: string[];
    time?: string;
    executionMode?: 'pessoa_fisica' | 'http';
  } | null;
  onRunRealPunch: () => void;
  currentUsuario?: string;
  currentSenha?: string;
  onUpdateCredentialsAndRetry?: (newUsuario: string, newSenha: string) => void;
  onTestHumanMode?: () => void;
}

export const TestResultModal: React.FC<TestResultModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  progressMessage,
  result,
  onRunRealPunch,
  currentUsuario = '',
  currentSenha = '',
  onUpdateCredentialsAndRetry,
  onTestHumanMode,
}) => {
  const [editUsuario, setEditUsuario] = useState(currentUsuario);
  const [editSenha, setEditSenha] = useState(currentSenha);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedScreenshotIdx, setSelectedScreenshotIdx] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setEditUsuario(currentUsuario);
    setEditSenha(currentSenha);
  }, [currentUsuario, currentSenha]);

  useEffect(() => {
    if (result?.screenshots && result.screenshots.length > 0) {
      setSelectedScreenshotIdx(result.screenshots.length - 1);
    }
  }, [result]);

  if (!isOpen) return null;

  const handleToggleCpfFormat = () => {
    const digits = editUsuario.replace(/\D/g, '');
    if (digits.length === 11) {
      if (editUsuario.includes('.')) {
        setEditUsuario(digits);
      } else {
        const formatted = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        setEditUsuario(formatted);
      }
    }
  };

  const handleRetryWithEditedCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateCredentialsAndRetry) {
      onUpdateCredentialsAndRetry(editUsuario, editSenha);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl pf-surface border pf-border rounded-3xl p-6 sm:p-7 shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b pf-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 pf-bg-accent-soft pf-text-accent rounded-xl border pf-border-accent">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                Teste de Conexão no Portal Real
              </h3>
              <p className="text-xs pf-text-muted">
                Pernambucanas LG Cloud (Dry-Run / Sem Bater Ponto Real)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 pf-text-muted hover:opacity-80 rounded-lg pf-surface-muted transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-full border-4 pf-border animate-spin"
                  style={{ borderTopColor: 'var(--pf-accent)' }}
                />
                <RotateCw className="w-6 h-6 pf-text-accent absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold">
                  Conectando diretamente ao servidor da Pernambucanas...
                </h4>
                <p className="text-xs pf-text-muted mt-1 max-w-sm">
                  {progressMessage || 'Validando conexão HTTPS, tokens e credenciais...'}
                </p>
              </div>
            </div>
          ) : result ? (
            result.success ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      {result.message ? 'Operação Concluída com Sucesso!' : '100% Validado! Conexão e Credenciais Aprovadas'}
                    </h4>
                    <p className="text-xs pf-text-secondary mt-1 leading-relaxed">
                      {result.message ||
                        'O sistema conectou diretamente aos servidores da Pernambucanas, submeteu sua autenticação e a sessão foi aprovada.'}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 pf-surface-muted border pf-border rounded-xl text-xs space-y-1.5">
                  <div className="font-semibold pf-text-accent flex items-center gap-1.5">
                    <span>É certeza que a marcação real funcionará?</span>
                  </div>
                  <p className="pf-text-secondary text-[11px] leading-relaxed">
                    <strong>SIM!</strong> Como o servidor da Pernambucanas aceitou seu usuário e
                    senha, a marcação real utilizará a mesma sessão autenticada para confirmar a
                    batida.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3">
                  <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-red-700 dark:text-red-300">
                      Resposta do Servidor da Pernambucanas
                    </h4>
                    <p className="text-xs pf-text-secondary mt-1 leading-relaxed">
                      {result.error ||
                        'O portal da Pernambucanas retornou: "Login e/ou senha inválidos. Informe-os novamente."'}
                    </p>
                  </div>
                </div>

                {onUpdateCredentialsAndRetry && (
                  <form
                    onSubmit={handleRetryWithEditedCredentials}
                    className="p-4 pf-surface-muted border pf-border-accent rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold pf-text-accent">
                        <KeyRound className="w-4 h-4" />
                        <span>Ajustar Usuário / Senha e Testar Novamente</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] pf-text-secondary font-semibold">
                            Usuário / CPF (Pernambucanas)
                          </label>
                          {editUsuario.replace(/\D/g, '').length === 11 && (
                            <button
                              type="button"
                              onClick={handleToggleCpfFormat}
                              className="text-[10px] pf-text-accent underline cursor-pointer"
                            >
                              {editUsuario.includes('.') ? 'Remover pontos' : 'Formatar CPF'}
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={editUsuario}
                          onChange={(e) => setEditUsuario(e.target.value)}
                          placeholder="Seu CPF ou Login corporativo"
                          className="w-full px-3 py-2 pf-surface border pf-border rounded-xl font-mono text-xs pf-ring-accent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] pf-text-secondary mb-1 font-semibold">
                          Senha de Acesso
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={editSenha}
                            onChange={(e) => setEditSenha(e.target.value)}
                            placeholder="Sua senha do portal LG Cloud"
                            className="w-full px-3 py-2 pr-10 pf-surface border pf-border rounded-xl font-mono text-xs pf-ring-accent"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 pf-text-muted hover:opacity-80 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 pf-btn-accent font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Salvar e Testar Novamente</span>
                    </button>
                  </form>
                )}

                {((result.screenshots && result.screenshots.length > 0) || result.screenshot) && (
                  <div className="p-4 pf-surface-muted border pf-border rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Camera className="w-4 h-4 pf-text-accent" />
                        <span>Capturas de Tela</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded pf-bg-accent-soft pf-text-accent border pf-border-accent font-mono">
                        Portal Oficial
                      </span>
                    </div>

                    {result.screenshots && result.screenshots.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {result.screenshots.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedScreenshotIdx(idx)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                              selectedScreenshotIdx === idx
                                ? 'pf-btn-accent'
                                : 'pf-surface pf-text-muted border pf-border'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="relative group rounded-xl overflow-hidden border pf-border bg-black/60">
                      <img
                        src={
                          result.screenshots && result.screenshots[selectedScreenshotIdx]
                            ? result.screenshots[selectedScreenshotIdx].dataUrl
                            : result.screenshot
                        }
                        alt="Captura de tela oficial do portal"
                        className="w-full max-h-60 sm:max-h-72 object-contain mx-auto cursor-pointer"
                        onClick={() => setIsZoomed(true)}
                      />
                      <button
                        type="button"
                        onClick={() => setIsZoomed(true)}
                        className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/80 text-white text-[11px] font-semibold rounded-lg border border-neutral-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5 pf-text-accent" />
                        <span>Ampliar Foto</span>
                      </button>
                    </div>
                  </div>
                )}

                {onTestHumanMode && result.executionMode !== 'pessoa_fisica' && (
                  <button
                    type="button"
                    onClick={onTestHumanMode}
                    className="w-full py-2.5 px-4 pf-surface-muted text-sky-600 dark:text-sky-400 border border-sky-500/30 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Ver o Navegador Fazendo o Processo</span>
                  </button>
                )}

                <div className="p-4 pf-surface-muted border pf-border rounded-2xl space-y-2">
                  <h5 className="text-xs font-bold pf-text-accent flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Conferir no Portal Oficial:</span>
                  </h5>
                  <a
                    href="https://pernambucanas.lgcloud.com.br/autenticacao/produtos/SAAA/principal2.aspx?c=pernambucanas"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 pf-surface pf-text-accent border pf-border-accent text-xs font-bold rounded-xl transition mt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Portal Oficial Pernambucanas</span>
                  </a>
                </div>

                {result.logs && result.logs.length > 0 && (
                  <details className="text-xs pf-surface-muted border pf-border rounded-xl p-3">
                    <summary className="cursor-pointer font-semibold pf-text-muted flex items-center gap-1.5 select-none">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Ver etapas técnicas ({result.logs.length})</span>
                    </summary>
                    <div className="mt-2.5 space-y-1 font-mono text-[10px] pf-text-muted max-h-36 overflow-y-auto">
                      {result.logs.map((log, i) => (
                        <div key={i} className="py-0.5 border-b pf-border">
                          {log}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          ) : null}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t pf-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold pf-text-muted hover:opacity-80 cursor-pointer"
          >
            Fechar
          </button>

          {result?.success && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRunRealPunch();
              }}
              className="flex items-center gap-2 px-5 py-2.5 pf-btn-accent font-bold text-xs rounded-xl transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Agora Bater Ponto Real</span>
            </button>
          )}
        </div>
      </div>

      {isZoomed && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="max-w-5xl w-full flex flex-col items-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white px-1">
              <span className="text-xs font-mono font-bold flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {result?.screenshots?.[selectedScreenshotIdx]?.label || 'Captura de Tela do Portal'}
              </span>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full max-h-[80vh] overflow-auto rounded-2xl border border-neutral-700 bg-neutral-950 flex items-center justify-center p-2">
              <img
                src={
                  result?.screenshots?.[selectedScreenshotIdx]?.dataUrl ||
                  result?.screenshot
                }
                alt="Captura ampliada do portal"
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
