import React, { useEffect, useRef, useState } from 'react';
import { Utensils, Bell, FastForward, X, Clock, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import {
  formatCountdown,
  PREVENTIVE_LUNCH_ALERT_SECONDS,
  shouldShowPreventiveLunchAlert,
} from '../utils/punch-rules';
import { playPreventiveLunchChime } from '../utils/sound-alarm';

interface PersistentLunchNotificationProps {
  remainingSeconds: number;
  totalDurationSeconds: number;
  startTimeStr: string;
  expectedEndTimeStr: string;
  notificationStatus?: string;
  onEnableNotifications?: () => void;
  onCancel: () => void;
  onFastForwardDemo: () => void;
}

export const PersistentLunchNotification: React.FC<PersistentLunchNotificationProps> = ({
  remainingSeconds,
  totalDurationSeconds,
  startTimeStr,
  expectedEndTimeStr,
  notificationStatus = 'default',
  onEnableNotifications,
  onCancel,
  onFastForwardDemo,
}) => {
  const isPreAlertActive = shouldShowPreventiveLunchAlert(
    remainingSeconds,
    PREVENTIVE_LUNCH_ALERT_SECONDS
  );
  const [preAlertMuted, setPreAlertMuted] = useState(false);
  const preAlertPlayedKeyRef = useRef<string | null>(null);
  const sessionKey = `${startTimeStr}-${expectedEndTimeStr}`;

  useEffect(() => {
    if (remainingSeconds > PREVENTIVE_LUNCH_ALERT_SECONDS) {
      preAlertPlayedKeyRef.current = null;
      return;
    }

    if (isPreAlertActive && preAlertPlayedKeyRef.current !== sessionKey) {
      preAlertPlayedKeyRef.current = sessionKey;
      if (!preAlertMuted) {
        playPreventiveLunchChime();
      }
    }
  }, [isPreAlertActive, remainingSeconds, sessionKey, preAlertMuted]);

  const progressPercent = Math.min(
    100,
    Math.max(0, ((totalDurationSeconds - remainingSeconds) / totalDurationSeconds) * 100)
  );

  return (
    <div
      className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 max-w-sm w-[calc(100vw-2rem)] sm:w-full pf-surface border-2 rounded-2xl shadow-2xl p-4 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 transition-colors ${
        isPreAlertActive
          ? 'border-amber-500 ring-2 ring-amber-400/40'
          : 'pf-border-accent-solid'
      }`}
    >
      <div className="flex items-center justify-between mb-2 pb-2 border-b pf-border">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg animate-pulse ${
              isPreAlertActive
                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-300'
                : 'pf-bg-accent-soft pf-text-accent'
            }`}
          >
            {isPreAlertActive ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Utensils className="w-4 h-4" />
            )}
          </div>
          <div>
            <h4
              className={`text-xs font-bold uppercase tracking-wider ${
                isPreAlertActive
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'pf-text-accent'
              }`}
            >
              {isPreAlertActive ? 'Retorno Iminente (< 1 min)' : 'Intervalo de Almoço Ativo'}
            </h4>
            <p className="text-[11px] pf-text-muted">
              {notificationStatus === 'granted'
                ? `Na barra do celular (${totalDurationSeconds === 3600 ? '1 hora' : `${Math.round(totalDurationSeconds / 60)} minutos`})`
                : `Contador local (${totalDurationSeconds === 3600 ? '1 hora' : `${Math.round(totalDurationSeconds / 60)} minutos`})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPreAlertMuted((m) => !m)}
            title={
              preAlertMuted
                ? 'Ativar som preventivo (1 min antes)'
                : 'Silenciar aviso sonoro preventivo (1 min antes)'
            }
            aria-label={preAlertMuted ? 'Ativar aviso sonoro preventivo' : 'Silenciar aviso sonoro preventivo'}
            className="pf-text-muted hover:opacity-80 p-1 rounded-md pf-surface-muted transition cursor-pointer"
          >
            {preAlertMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 pf-text-accent" />}
          </button>

          <button
            type="button"
            onClick={onCancel}
            title="Cancelar monitoramento"
            aria-label="Cancelar monitoramento"
            className="pf-text-muted hover:opacity-80 p-1 rounded-md pf-surface-muted transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preventive 1-Minute Warning Banner */}
      {isPreAlertActive && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-3 px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-800 dark:text-amber-200 flex items-start gap-2.5 animate-in fade-in duration-200"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-300 shrink-0 mt-0.5 animate-bounce" />
          <div className="text-[11px] leading-snug">
            <div className="font-extrabold uppercase tracking-wide">
              Falta menos de 1 min · Prepare-se!
            </div>
            <p className="mt-0.5 opacity-95">
              Fique pronto no dispositivo para bater o ponto pontualmente às{' '}
              <strong className="font-mono">{expectedEndTimeStr}</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between my-2">
        <div>
          <span
            className={`text-3xl font-black font-mono tracking-tight ${
              isPreAlertActive ? 'text-amber-600 dark:text-amber-300 animate-pulse' : ''
            }`}
          >
            {formatCountdown(remainingSeconds)}
          </span>
          <span className="text-xs pf-text-muted ml-2">restantes</span>
        </div>
        <div className="text-right text-[11px] pf-text-muted">
          <div className="flex items-center gap-1 justify-end">
            <Clock className={`w-3 h-3 ${isPreAlertActive ? 'text-amber-500' : 'pf-text-accent'}`} />
            <span>Retorno às <strong>{expectedEndTimeStr}</strong></span>
          </div>
          <span className="text-[10px] pf-text-muted">Iniciado às {startTimeStr}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 mb-3 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: isPreAlertActive ? '#f59e0b' : 'var(--pf-accent)',
          }}
        />
      </div>

      {notificationStatus !== 'granted' && notificationStatus !== 'unsupported' && onEnableNotifications && (
        <div className="mb-2.5 px-2.5 py-2 rounded-xl pf-bg-accent-soft border pf-border-accent flex items-center justify-between gap-2">
          <span className="text-[10px] pf-text-secondary leading-tight">
            {notificationStatus === 'denied'
              ? 'Notificações bloqueadas no navegador.'
              : 'Ative para aparecer na barra do celular.'}
          </span>
          <button
            type="button"
            onClick={onEnableNotifications}
            className="px-2.5 py-1 pf-btn-accent font-bold text-[10px] rounded-lg shrink-0 cursor-pointer transition"
          >
            {notificationStatus === 'denied' ? 'Ver Ajuda' : 'Ativar Barra'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-[11px] pf-text-secondary">
          <Bell className={`w-3.5 h-3.5 shrink-0 ${isPreAlertActive ? 'text-amber-500 animate-pulse' : 'pf-text-accent'}`} />
          <span>
            {isPreAlertActive ? 'Alarme final em segundos...' : 'Pré-aviso 1m + alarme no retorno'}
          </span>
        </div>

        <button
          type="button"
          onClick={onFastForwardDemo}
          title="Acelera o tempo para 5 segundos para testar o alarme imediatamente"
          className="inline-flex items-center gap-1 px-2.5 py-1 pf-bg-accent-soft hover:opacity-90 pf-text-accent border pf-border-accent rounded-lg text-[10px] font-semibold transition cursor-pointer"
        >
          <FastForward className="w-3 h-3" />
          <span>Testar Alarme (5s)</span>
        </button>
      </div>
    </div>
  );
};

