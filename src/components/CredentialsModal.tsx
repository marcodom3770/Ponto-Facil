import React, { useState } from 'react';
import { KeyRound, User, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (credentials: { usuario: string; senha: string }) => void;
  initialUsuario?: string;
  initialSenha?: string;
  isFirstSetup?: boolean;
}

export const CredentialsModal: React.FC<CredentialsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialUsuario = '',
  initialSenha = '',
  isFirstSetup = false,
}) => {
  const [usuario, setUsuario] = useState(initialUsuario);
  const [senha, setSenha] = useState(initialSenha);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setUsuario(initialUsuario);
      setSenha(initialSenha);
      setError('');
    }
  }, [isOpen, initialUsuario, initialSenha]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) {
      setError('Por favor, informe seu usuário de login da Pernambucanas.');
      return;
    }
    if (!senha.trim()) {
      setError('Por favor, informe sua senha de acesso.');
      return;
    }
    setError('');
    onSave({ usuario: usuario.trim(), senha });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md pf-surface border pf-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 pf-bg-accent rounded-xl shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {isFirstSetup ? 'Configuração Inicial' : 'Editar Credenciais'}
            </h2>
            <p className="text-xs pf-text-muted">
              Portal Nossa Gente • Grupo Pernambucanas
            </p>
          </div>
        </div>

        {isFirstSetup && (
          <div className="pf-bg-accent-soft border pf-border-accent rounded-xl p-3 mb-5 text-xs flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 pf-text-accent" />
            <p className="pf-text-secondary">
              Suas credenciais serão salvas neste navegador para você bater o ponto com 1 clique.
              Para alterá-las depois, basta acessar as <strong>Configurações (⚙️)</strong>.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider pf-text-secondary mb-1.5">
              Usuário / Login (Pernambucanas)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none pf-text-muted">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ex: seu.usuario ou CPF"
                id="ContentPlaceHolder_txtLoginT"
                name="usuario"
                className="w-full pl-10 pr-4 py-2.5 pf-surface-muted border pf-border rounded-lg text-sm pf-ring-accent transition"
                autoFocus
              />
            </div>
            <p className="text-[11px] pf-text-muted mt-1">
              Corresponde ao campo <code className="pf-text-accent font-mono">#ContentPlaceHolder_txtLoginT</code>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider pf-text-secondary mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none pf-text-muted">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha do portal"
                id="ContentPlaceHolder_txtSenhaT"
                name="senha"
                className="w-full pl-10 pr-10 py-2.5 pf-surface-muted border pf-border rounded-lg text-sm pf-ring-accent transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center pf-text-muted hover:opacity-80 cursor-pointer"
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] pf-text-muted mt-1">
              Corresponde ao campo <code className="pf-text-accent font-mono">#ContentPlaceHolder_txtSenhaT</code>
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end space-x-3">
            {!isFirstSetup && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium pf-text-muted hover:opacity-80 pf-surface-muted border pf-border rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2.5 pf-btn-accent font-bold text-sm rounded-lg active:scale-95 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isFirstSetup ? 'Salvar e Iniciar App' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
