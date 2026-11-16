import React from 'react';
import { BellRing, Play, VolumeX, Sparkles, AlertTriangle } from 'lucide-react';

interface AlarmReturnModalProps {
  isOpen: boolean;
  onInitiatePunchAgain: () => void;
  onDismissAlarm: () => void;
}

export const AlarmReturnModal: React.FC<AlarmReturnModalProps> = ({
  isOpen,
  onInitiatePunchAgain,
  onDismissAlarm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-lg pf-surface border-4 pf-border-accent-solid rounded-3xl shadow-2xl p-6 sm:p-8 text-center overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-2 animate-pulse"
          style={{ backgroundColor: 'var(--pf-accent)' }}
        />

        <div className="mx-auto w-20 h-20 mb-4 pf-bg-accent rounded-full flex items-center justify-center shadow-lg animate-bounce">
          <BellRing className="w-10 h-10 animate-spin" style={{ animationDuration: '3s' }} />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 text-xs font-bold uppercase tracking-wider mb-2 border border-red-500/30">
          <AlertTriangle className="w-4 h-4" />
          Intervalo de Almoço Concluído!
        </div>

        <h2 className="text-2xl sm:text-3xl font-black pf-text-accent tracking-tight mb-2">
          HORA DE RETORNAR DO ALMOÇO!
        </h2>

        <p className="text-sm pf-text-secondary max-w-md mx-auto mb-6 leading-relaxed">
          Seu período de intervalo terminou e o alarme está tocando.
          Deseja <strong>abrir o portal agora</strong> com seu CPF e senha preenchidos para registrar seu ponto de retorno?
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onInitiatePunchAgain}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 pf-btn-accent rounded-2xl font-black text-base active:scale-95 transition transform hover:-translate-y-0.5 cursor-pointer"
            autoFocus
          >
            <Play className="w-5 h-5 fill-current" />
            <span>ABRIR PORTAL E BATER RETORNO AGORA</span>
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onDismissAlarm}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 pf-surface-muted hover:opacity-90 pf-text-secondary rounded-xl font-bold text-xs border pf-border transition cursor-pointer"
          >
            <VolumeX className="w-4 h-4 pf-text-muted" />
            <span>Silenciar Alarme e Dispensar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
