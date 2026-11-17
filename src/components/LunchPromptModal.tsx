import React from 'react';
import { Utensils, CheckCircle2, Clock, X, Bell } from 'lucide-react';
import { computeLunchEndTimeFromTimeStr } from '../utils/punch-rules';

interface LunchPromptModalProps {
  isOpen: boolean;
  registeredTime: string;
  durationMinutes?: number;
  onConfirmLunch: () => void;
  onDismiss: () => void;
}

export const LunchPromptModal: React.FC<LunchPromptModalProps> = ({
  isOpen,
  registeredTime,
  durationMinutes = 60,
  onConfirmLunch,
  onDismiss,
}) => {
  if (!isOpen) return null;

  const durationLabel = durationMinutes === 60 ? '1 hora' : `${durationMinutes} minutos`;
  const zeroSecondEndTime = registeredTime
    ? computeLunchEndTimeFromTimeStr(registeredTime, durationMinutes)
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md pf-surface border-2 pf-border-accent-solid rounded-2xl shadow-2xl overflow-hidden p-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-4 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Ponto Gravado com Sucesso
        </div>

        <div className="mb-4">
          <p className="text-xs uppercase tracking-widest pf-text-muted mb-1">Horário Registrado</p>
          <div className="text-4xl font-black pf-text-accent tracking-wider font-mono flex items-center justify-center gap-2">
            <Clock className="w-7 h-7" />
            <span>{registeredTime}</span>
          </div>
        </div>

        <div className="pf-surface-muted rounded-xl p-4 border pf-border mb-6">
          <div className="w-10 h-10 mx-auto mb-2 pf-bg-accent-soft pf-text-accent rounded-full flex items-center justify-center">
            <Utensils className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold mb-1">
            É horário de almoço?
          </h3>
          <p className="text-xs pf-text-secondary leading-relaxed">
            Se for <strong>Sim</strong>, o alarme ({durationLabel}) despertará pontualmente às{' '}
            <strong className="font-mono pf-text-accent">{zeroSecondEndTime || '--:--:00'}</strong>{' '}
            (no início do minuto, com segundos zerados) mesmo com a tela bloqueada!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center justify-center gap-2 px-4 py-3 pf-surface-muted hover:opacity-90 border pf-border rounded-xl font-bold text-sm transition active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4 pf-text-muted" />
            <span>Não</span>
          </button>

          <button
            type="button"
            onClick={onConfirmLunch}
            className="flex items-center justify-center gap-2 px-4 py-3 pf-btn-accent rounded-xl font-extrabold text-sm transition active:scale-95 cursor-pointer"
            autoFocus
          >
            <Bell className="w-4 h-4" />
            <span>Sim ({durationLabel})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
