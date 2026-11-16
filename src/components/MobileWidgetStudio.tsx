import React, { useState } from 'react';
import {
  Smartphone,
  Pin,
  PinOff,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  Fingerprint,
  PictureInPicture2,
  ShieldCheck,
  Bell,
  Layers,
  Info,
  Play,
} from 'lucide-react';
import {
  PunchRecord,
  WorkScheduleConfig,
  buildWidgetPayload,
  formatTime,
} from '../utils/punch-rules';
import {
  MobileNotificationStatus,
  detectWidgetCapabilities,
} from '../utils/service-worker-client';

interface MobileWidgetStudioProps {
  todayPunches: PunchRecord[];
  schedule: WorkScheduleConfig;
  currentDate: Date;
  privacyMode: boolean;
  widgetPinned: boolean;
  notificationPermission: MobileNotificationStatus;
  onTogglePinWidget: (pinned: boolean) => Promise<void>;
  onForceSyncWidget: () => Promise<void>;
  onOpenFloatingMiniWidget: () => void;
  onInitiatePunch: () => void;
}

type WidgetPreviewSize = 'medium' | 'compact' | 'lockscreen';

export const MobileWidgetStudio: React.FC<MobileWidgetStudioProps> = ({
  todayPunches,
  schedule,
  currentDate,
  privacyMode,
  widgetPinned,
  notificationPermission,
  onTogglePinWidget,
  onForceSyncWidget,
  onOpenFloatingMiniWidget,
  onInitiatePunch,
}) => {
  const [previewSize, setPreviewSize] = useState<WidgetPreviewSize>('medium');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const payload = buildWidgetPayload(todayPunches, schedule, currentDate, privacyMode);
  const caps = detectWidgetCapabilities();
  const liveClock = formatTime(currentDate);

  const handleTogglePin = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const next = !widgetPinned;
      await onTogglePinWidget(next);
      setSyncMessage(
        next
          ? 'Widget de marcações fixado! Confira na barra de notificações / tela bloqueada do seu celular.'
          : 'Widget desafixado da barra de notificações.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await onForceSyncWidget();
      setSyncMessage(`Widget sincronizado às ${payload.updatedAt} com ${payload.punchCount} marcação(ões).`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Header Banner */}
      <div className="pf-surface border pf-card-radius p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider pf-text-accent">
            <Smartphone className="w-4 h-4" />
            <span>Central de Widgets no Celular</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
            Suas Marcações de Hoje Direto na Tela
          </h2>
          <p className="text-xs sm:text-sm pf-text-muted mt-1 max-w-2xl leading-relaxed">
            Exiba suas batidas do dia na tela bloqueada/barra do celular, fixe em janela flutuante ou instale o app com atalhos de 1 toque e suporte nativo a Adaptive Cards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleTogglePin}
            className={`inline-flex items-center gap-2 px-4 py-2.5 pf-control-radius text-xs font-extrabold transition cursor-pointer ${
              widgetPinned
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'pf-btn-accent'
            }`}
          >
            {widgetPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            <span>
              {widgetPinned ? 'Widget Fixado (Desativar)' : 'Fixar Widget no Celular'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenFloatingMiniWidget}
            className="inline-flex items-center gap-2 px-4 py-2.5 pf-control-radius pf-surface-muted border pf-border hover:opacity-90 text-xs font-bold transition cursor-pointer"
          >
            <PictureInPicture2 className="w-4 h-4 pf-text-accent" />
            <span>Widget Flutuante</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="pf-bg-accent-soft border pf-border-accent pf-control-radius px-4 py-3 text-xs font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 pf-text-accent shrink-0" />
            <span>{syncMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => setSyncMessage(null)}
            className="pf-text-muted hover:opacity-80 text-[11px] font-semibold cursor-pointer"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* Main 2-Column Bento: Interactive Phone Preview + Activation & Platform Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live Interactive Phone Mockup */}
        <div className="lg:col-span-5 pf-surface border pf-card-radius p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Prévia Real do Widget</h3>
              <p className="text-[11px] pf-text-muted">Atualizado em tempo real com seus dados</p>
            </div>
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 pf-control-radius pf-surface-muted border pf-border text-[11px] font-bold pf-text-accent cursor-pointer hover:opacity-90"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>

          {/* Preview Size Selector */}
          <div className="grid grid-cols-3 gap-1.5 p-1 pf-surface-muted pf-control-radius border pf-border">
            {(
              [
                { id: 'medium', label: 'Card 4×2' },
                { id: 'compact', label: 'Compacto 2×1' },
                { id: 'lockscreen', label: 'Tela Bloqueada' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPreviewSize(opt.id)}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  previewSize === opt.id ? 'pf-btn-accent' : 'pf-text-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Realistic Phone Screen Frame */}
          <div className="mx-auto w-full max-w-[320px] rounded-[2rem] border-4 border-slate-800 dark:border-slate-700 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 text-white shadow-2xl space-y-4">
            {/* Phone Status Strip */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
              <span>{liveClock.slice(0, 5)}</span>
              <span className="h-2.5 w-14 rounded-full bg-black/80 border border-white/10" />
              <span>5G · 94%</span>
            </div>

            {previewSize === 'lockscreen' && (
              <div className="text-center py-2 space-y-0.5">
                <div className="text-4xl font-extrabold font-mono tracking-tight tabular-nums">
                  {liveClock.slice(0, 5)}
                </div>
                <div className="text-[11px] text-slate-400 capitalize">{payload.dateStr}</div>
              </div>
            )}

            {/* Rendered Live Widget Card Inside Phone */}
            {previewSize === 'medium' && (
              <div
                className="rounded-2xl border p-4 space-y-3 shadow-lg"
                style={{
                  backgroundColor: 'rgba(20, 24, 34, 0.92)',
                  borderColor: 'var(--pf-accent-border)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className="text-[9px] font-extrabold uppercase tracking-wider"
                      style={{ color: 'var(--pf-accent)' }}
                    >
                      PERNAMBUCANAS · PONTOFÁCIL
                    </div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      Marcações de Hoje ({payload.punchCount})
                    </div>
                  </div>
                  <div
                    className="text-sm font-black font-mono tabular-nums px-2 py-1 rounded-lg"
                    style={{
                      backgroundColor: 'var(--pf-accent-soft)',
                      color: 'var(--pf-accent)',
                    }}
                  >
                    {payload.workedText}
                  </div>
                </div>

                {/* 4 Punch Slots inside widget */}
                <div className="grid grid-cols-4 gap-1.5">
                  {payload.slots.map((slot) => {
                    const shortLabel =
                      slot.label === 'Ida Almoço'
                        ? 'Almoço'
                        : slot.label === 'Volta Almoço'
                          ? 'Retorno'
                          : slot.label;
                    return (
                      <div
                        key={slot.label}
                        className="rounded-xl p-2 text-center border"
                        style={{
                          backgroundColor: slot.filled
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(255,255,255,0.02)',
                          borderColor: slot.filled
                            ? 'var(--pf-accent-border)'
                            : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <div className="text-[8px] text-slate-400">{shortLabel}</div>
                        <div
                          className="text-[11px] font-mono font-extrabold mt-0.5 tabular-nums"
                          style={{ color: slot.filled ? '#ffffff' : '#64748b' }}
                        >
                          {slot.time}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-300">
                  <span>
                    Próx: <strong>{payload.nextPunchLabel}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={onInitiatePunch}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer"
                    style={{
                      backgroundColor: 'var(--pf-accent)',
                      color: 'var(--pf-accent-fg)',
                    }}
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>Bater</span>
                  </button>
                </div>
              </div>
            )}

            {previewSize === 'compact' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div
                  className="rounded-2xl border p-3 space-y-1.5"
                  style={{
                    backgroundColor: 'rgba(20, 24, 34, 0.92)',
                    borderColor: 'var(--pf-accent-border)',
                  }}
                >
                  <div
                    className="text-[9px] font-extrabold uppercase"
                    style={{ color: 'var(--pf-accent)' }}
                  >
                    Hoje ({payload.punchCount})
                  </div>
                  <div className="text-lg font-black font-mono tabular-nums text-white">
                    {payload.workedText}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Próx: {payload.nextPunchLabel}
                  </div>
                </div>

                <div
                  className="rounded-2xl border p-3 flex flex-col justify-between"
                  style={{
                    backgroundColor: 'rgba(20, 24, 34, 0.92)',
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="text-[9px] text-slate-400 font-semibold">Últimas batidas</div>
                  <div className="text-xs font-mono font-bold text-white space-y-0.5 tabular-nums">
                    {payload.slots.filter((s) => s.filled).length > 0 ? (
                      payload.slots
                        .filter((s) => s.filled)
                        .slice(-2)
                        .map((s) => (
                          <div key={s.label}>
                            {s.label.split(' ')[0]}: {s.time}
                          </div>
                        ))
                    ) : (
                      <div className="text-slate-500">--:--</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {previewSize === 'lockscreen' && (
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 space-y-2 text-left">
                <div className="flex items-center justify-between text-[10px] text-slate-300">
                  <span className="font-bold flex items-center gap-1.5">
                    <Bell className="w-3 h-3" style={{ color: 'var(--pf-accent)' }} />
                    <span>PontoFácil · agora</span>
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">Fixo</span>
                </div>
                <div className="text-xs font-extrabold text-white leading-snug">
                  {payload.notificationTitle}
                </div>
                <div className="text-[11px] text-slate-300 leading-snug">
                  {payload.notificationBody}
                </div>
                <div className="flex items-center gap-3 pt-1 text-[10px] font-bold" style={{ color: 'var(--pf-accent)' }}>
                  <span>▶️ Bater Ponto</span>
                  <span>🔄 Atualizar</span>
                </div>
              </div>
            )}

            {/* Simulated Android Dock Icons below widget */}
            {previewSize !== 'lockscreen' && (
              <div className="grid grid-cols-4 gap-3 pt-3 border-t border-white/10 text-center">
                {['PontoFácil', 'Portal LG', 'Agenda', 'Ajustes'].map((appLabel, idx) => (
                  <div key={appLabel} className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/15"
                      style={{
                        backgroundColor: idx === 0 ? 'var(--pf-accent)' : 'rgba(255,255,255,0.08)',
                        color: idx === 0 ? 'var(--pf-accent-fg)' : '#cbd5e1',
                      }}
                    >
                      {idx === 0 ? (
                        <Fingerprint className="w-5 h-5" />
                      ) : idx === 1 ? (
                        <ExternalLink className="w-4 h-4" />
                      ) : idx === 2 ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <Layers className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400">{appLabel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Real Functional Activation Options & Honest Platform Behavior */}
        <div className="lg:col-span-7 space-y-4">
          {/* Option 1: Lockscreen & Notification Drawer Widget */}
          <div className="pf-surface border pf-card-radius p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 pf-control-radius pf-bg-accent-soft pf-text-accent border pf-border-accent">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">
                    1. Widget Permanente na Tela Bloqueada &amp; Barra (Android)
                  </h4>
                  <p className="text-xs pf-text-muted">
                    Funciona direto no Chrome do Android, Samsung Internet e Edge Mobile sem precisar instalar nada da Play Store.
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 pf-control-radius shrink-0 border ${
                  widgetPinned && notificationPermission === 'granted'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'pf-surface-muted pf-text-muted pf-border'
                }`}
              >
                {widgetPinned && notificationPermission === 'granted' ? 'Ativo' : 'Desativado'}
              </span>
            </div>

            <p className="text-xs pf-text-secondary leading-relaxed">
              Toda vez que você registra, sincroniza ou apaga um ponto hoje, o Service Worker atualiza silenciosamente o cartão fixo com suas batidas exatas (<strong>{payload.punchCount} hoje</strong>) e botão rápido de <strong>Bater Ponto</strong>.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleTogglePin}
                className={`px-4 py-2 pf-control-radius text-xs font-extrabold transition cursor-pointer ${
                  widgetPinned ? 'pf-surface-muted border pf-border' : 'pf-btn-accent'
                }`}
              >
                {widgetPinned ? 'Desafixar da Barra' : 'Ativar Widget na Barra Agora'}
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleSyncNow}
                className="px-3.5 py-2 pf-control-radius text-xs font-bold pf-surface-muted border pf-border hover:opacity-90 cursor-pointer"
              >
                Forçar Atualização
              </button>
            </div>
          </div>

          {/* Option 2: Floating Picture-in-Picture / Mini-Widget */}
          <div className="pf-surface border pf-card-radius p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 pf-control-radius pf-bg-accent-soft pf-text-accent border pf-border-accent">
                  <PictureInPicture2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">
                    2. Widget Flutuante Sempre Visível (Mini-Janela)
                  </h4>
                  <p className="text-xs pf-text-muted">
                    Abre um mini-card compacto com relógio ao vivo, batidas de hoje e botão rápido.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 pf-control-radius pf-bg-accent-soft pf-text-accent border pf-border-accent">
                {caps.hasDocumentPiP ? 'PiP Nativo' : 'Mini-Card In-App'}
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenFloatingMiniWidget}
              className="px-4 py-2 pf-btn-accent pf-control-radius text-xs font-extrabold cursor-pointer transition"
            >
              Abrir Widget Flutuante Agora
            </button>
          </div>

          {/* Option 3: Home Screen Icons, Shortcuts & Microsoft Edge Native PWA Widget */}
          <div className="pf-surface border pf-card-radius p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 pf-control-radius pf-bg-accent-soft pf-text-accent border pf-border-accent">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold">
                  3. Atalhos na Tela Inicial &amp; Widget PWA (Manifest + Adaptive Card)
                </h4>
                <p className="text-xs pf-text-muted">
                  Como colocar direto na área de trabalho do celular com transparência técnica:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="pf-surface-muted pf-control-radius border pf-border p-3.5 space-y-1.5">
                <div className="font-bold pf-text-accent">Android (Chrome / Edge)</div>
                <ol className="list-decimal list-inside space-y-1 pf-text-secondary text-[11px] leading-relaxed">
                  <li>
                    Instale clicando em <strong>Instalar no Celular</strong> ou menu <strong>⋮ &gt; Instalar app</strong>.
                  </li>
                  <li>
                    Segure o ícone do <strong>PontoFácil</strong> na tela para abrir o atalho rápido <strong>Bater Ponto Agora</strong>.
                  </li>
                  <li>
                    No <strong>Microsoft Edge</strong>, adicione o widget nativo <strong>Marcações de Hoje</strong> pelo painel de widgets.
                  </li>
                </ol>
              </div>

              <div className="pf-surface-muted pf-control-radius border pf-border p-3.5 space-y-1.5">
                <div className="font-bold pf-text-accent">iPhone / iPad (iOS Safari)</div>
                <ol className="list-decimal list-inside space-y-1 pf-text-secondary text-[11px] leading-relaxed">
                  <li>
                    No Safari, toque em <strong>Compartilhar</strong> &gt; <strong>Adicionar à Tela de Início</strong>.
                  </li>
                  <li>
                    Limitação do iOS: o Safari não permite widgets Web na Tela Inicial, apenas ícone PWA + notificações no app instalado.
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] pf-text-muted">
              <Info className="w-3.5 h-3.5 pf-text-accent shrink-0" />
              <span>
                Status do dispositivo: Service Worker {caps.hasServiceWorker ? 'pronto' : 'indisponível'} · Notificações{' '}
                {notificationPermission === 'granted'
                  ? 'ativadas'
                  : notificationPermission === 'denied'
                    ? 'bloqueadas'
                    : notificationPermission === 'default'
                      ? 'aguardando permissão'
                      : 'indisponíveis'}{' '}
                · Modo {caps.isStandalonePWA ? 'App Instalado' : 'Navegador'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
