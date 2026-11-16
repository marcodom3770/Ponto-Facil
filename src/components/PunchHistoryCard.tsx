import React from 'react';
import {
  Clock,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
  Zap,
  Bot,
  Hand,
  SearchCheck,
  RefreshCw,
  EyeOff,
  Trash2,
  PlusCircle,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import {
  PunchRecord,
  WorkScheduleConfig,
  DEFAULT_WORK_SCHEDULE,
  ClockStyle,
  AutoVisibility,
  IncompleteWorkDay,
  getGreeting,
  calculateJourneyPrediction,
  formatMinutesToHours,
  timeStringToMinutes,
} from '../utils/punch-rules';

interface PunchHistoryCardProps {
  currentTime: string;
  currentDateStr: string;
  currentDate: Date;
  punches: PunchRecord[];
  totalHistoryCount?: number;
  incompleteDays?: IncompleteWorkDay[];
  privacyMode?: boolean;
  schedule?: WorkScheduleConfig;
  clockStyle?: ClockStyle;
  onViewBancoDeHoras?: () => void;
  isPunching: boolean;
  humanMode?: boolean;
  autoVisibility?: AutoVisibility;
  onToggleHumanMode?: () => void;
  onChangeExecutionOption?: (humanMode: boolean, visibility: AutoVisibility) => void;
  onInitiatePunch: () => void;
  onSimulatePunch: () => void;
  onQuickManualPunch?: () => void;
  onDeletePunch?: (id: string) => void;
  onTestPortalConnection: () => void;
  onTestHumanPortal?: () => void;
  onVerifyPunchesToday?: () => void;
  isVerifyingPunches?: boolean;
}

const AnalogClockFace: React.FC<{ date: Date; timeStr: string; privacyMode?: boolean }> = ({
  date,
  timeStr,
  privacyMode,
}) => {
  const secs = date.getSeconds();
  const mins = date.getMinutes() + secs / 60;
  const hrs = (date.getHours() % 12) + mins / 60;

  const secAngle = secs * 6;
  const minAngle = mins * 6;
  const hourAngle = hrs * 30;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="relative w-36 h-36 sm:w-40 sm:h-40">
        <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-sm">
          <circle
            cx="60"
            cy="60"
            r="56"
            fill="var(--pf-surface-muted)"
            stroke="var(--pf-accent-border)"
            strokeWidth="2.5"
          />
          {Array.from({ length: 12 }).map((_, idx) => {
            const ang = (idx * 30 * Math.PI) / 180;
            const inner = idx % 3 === 0 ? 44 : 48;
            const outer = 52;
            const x1 = 60 + inner * Math.sin(ang);
            const y1 = 60 - inner * Math.cos(ang);
            const x2 = 60 + outer * Math.sin(ang);
            const y2 = 60 - outer * Math.cos(ang);
            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={idx % 3 === 0 ? 'var(--pf-accent)' : 'var(--pf-text-muted)'}
                strokeWidth={idx % 3 === 0 ? '2.2' : '1.1'}
                strokeLinecap="round"
              />
            );
          })}
          {/* Hour hand */}
          <line
            x1="60"
            y1="60"
            x2={60 + 28 * Math.sin((hourAngle * Math.PI) / 180)}
            y2={60 - 28 * Math.cos((hourAngle * Math.PI) / 180)}
            stroke="var(--pf-text)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Minute hand */}
          <line
            x1="60"
            y1="60"
            x2={60 + 40 * Math.sin((minAngle * Math.PI) / 180)}
            y2={60 - 40 * Math.cos((minAngle * Math.PI) / 180)}
            stroke="var(--pf-text-secondary)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Second sweep hand */}
          <line
            x1="60"
            y1="66"
            x2={60 + 46 * Math.sin((secAngle * Math.PI) / 180)}
            y2={60 - 46 * Math.cos((secAngle * Math.PI) / 180)}
            stroke="var(--pf-accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="60" cy="60" r="3.6" fill="var(--pf-accent)" />
        </svg>
      </div>
      <div className="font-mono text-sm font-bold tabular-nums pf-text-accent">
        {privacyMode ? '••:••:••' : timeStr}
      </div>
    </div>
  );
};

export const PunchHistoryCard: React.FC<PunchHistoryCardProps> = ({
  currentTime,
  currentDateStr,
  currentDate,
  punches,
  totalHistoryCount = 0,
  incompleteDays = [],
  privacyMode = false,
  schedule = DEFAULT_WORK_SCHEDULE,
  clockStyle = 'digital',
  onViewBancoDeHoras,
  isPunching,
  humanMode = true,
  autoVisibility = 'visible',
  onToggleHumanMode,
  onChangeExecutionOption,
  onInitiatePunch,
  onSimulatePunch,
  onQuickManualPunch,
  onDeletePunch,
  onTestPortalConnection,
  onVerifyPunchesToday,
  isVerifyingPunches = false,
}) => {
  const greeting = getGreeting(currentDate);
  const sortedPunches = [...punches].sort(
    (a, b) => timeStringToMinutes(a.shortTime || a.time) - timeStringToMinutes(b.shortTime || b.time)
  );
  const prediction = calculateJourneyPrediction(sortedPunches, schedule, currentDate, currentDate);
  const [hours, mins, secs] = currentTime.split(':');

  const isAutoVisible = humanMode && autoVisibility === 'visible';
  const isAutoBackground = humanMode && autoVisibility === 'background';
  const isManual = !humanMode;

  const selectOption = (nextHuman: boolean, nextVis: AutoVisibility) => {
    if (onChangeExecutionOption) {
      onChangeExecutionOption(nextHuman, nextVis);
    } else if (onToggleHumanMode && nextHuman !== humanMode) {
      onToggleHumanMode();
    }
  };

  const shiftSlots = ['Entrada', 'Almoço', 'Retorno', 'Saída'].map((label, idx) => {
    const rec = sortedPunches[idx];
    const isNext = !rec && idx === sortedPunches.length;
    return {
      label,
      time: rec ? (privacyMode ? '••:••' : rec.shortTime || rec.time.slice(0, 5)) : '--:--',
      filled: Boolean(rec),
      isNext,
    };
  });

  return (
    <div className="w-full max-w-6xl space-y-5">
      {/* Missing Past Punch Warning Banner (when applicable) */}
      {incompleteDays.length > 0 && (
        <div className="pf-surface border border-amber-500/35 pf-control-radius px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Atenção no espelho:</strong> {incompleteDays.length}{' '}
              {incompleteDays.length === 1 ? 'dia anterior possui' : 'dias anteriores possuem'}{' '}
              marcação ímpar (ex: <em>{incompleteDays[0].dateLabel}</em>).
            </span>
          </div>
          {onViewBancoDeHoras && (
            <button
              type="button"
              onClick={onViewBancoDeHoras}
              className="pf-text-accent font-bold underline cursor-pointer text-[11px]"
            >
              Revisar no Banco de Horas
            </button>
          )}
        </div>
      )}

      {/* Bento 2-Column Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT COLUMN (7 cols): Hero Clock + 4-Step Shift Strip + Execution Switcher + Primary CTA */}
        <section className="lg:col-span-7 pf-surface border pf-card-radius p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest pf-text-accent">
                {greeting} · Turno Ativo
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight capitalize mt-0.5">
                {currentDateStr}
              </h2>
            </div>

            {prediction.isExtraDay ? (
              <span className="text-[11px] px-2.5 py-1 pf-control-radius font-bold pf-bg-accent-soft pf-text-accent border pf-border-accent">
                Folga · 100% Extra
              </span>
            ) : (
              <span className="text-[11px] font-mono pf-text-muted tabular-nums">
                SAAA · {schedule.workStart}–{schedule.workEnd}
              </span>
            )}
          </div>

          {/* 5 Selectable Clock Faces */}
          <div className="py-2 flex flex-col items-center justify-center text-center">
            {clockStyle === 'analog' ? (
              <AnalogClockFace date={currentDate} timeStr={currentTime} privacyMode={privacyMode} />
            ) : clockStyle === 'segmented' ? (
              <div
                className="flex items-center gap-2 select-none tabular-nums"
                aria-label={`Horário atual ${currentTime}`}
              >
                {[hours || '00', mins || '00', secs || '00'].map((part, idx) => (
                  <React.Fragment key={idx}>
                    <div className="pf-surface-muted border pf-border-accent pf-control-radius px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-[66px] sm:min-w-[78px]">
                      <span className="text-3xl sm:text-5xl font-black font-mono pf-text-accent leading-none">
                        {privacyMode ? '••' : part}
                      </span>
                    </div>
                    {idx < 2 && (
                      <span className="text-2xl sm:text-4xl font-black pf-text-accent">:</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : clockStyle === 'minimal' ? (
              <div className="flex items-baseline justify-center gap-2 select-none tabular-nums">
                <span className="text-6xl sm:text-7xl font-light font-mono tracking-tighter pf-text-accent">
                  {privacyMode ? '••:••' : `${hours}:${mins}`}
                </span>
                <span className="text-2xl sm:text-3xl font-semibold font-mono pf-text-muted">
                  {privacyMode ? '••' : secs}
                </span>
              </div>
            ) : clockStyle === 'progress' ? (
              <div className="w-full max-w-[340px] pf-surface-muted border pf-border pf-card-radius px-5 py-4 space-y-2.5 select-none">
                <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight pf-text-accent tabular-nums">
                  {privacyMode ? '••:••:••' : currentTime}
                </div>
                <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${prediction.progressPercent}%`,
                      backgroundColor: 'var(--pf-accent)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono pf-text-muted tabular-nums">
                  <span>Jornada: {prediction.progressPercent}%</span>
                  <span>
                    {formatMinutesToHours(prediction.workedMinutes, false)}
                    {!prediction.isExtraDay && prediction.expectedMinutes > 0
                      ? ` / ${formatMinutesToHours(prediction.expectedMinutes, false)}`
                      : ''}
                  </span>
                </div>
              </div>
            ) : (
              <div
                className="text-5xl sm:text-7xl font-black font-mono tracking-tight pf-text-accent select-none tabular-nums"
                style={{ textShadow: '0 0 28px var(--pf-accent-glow)' }}
              >
                {privacyMode ? '••:••:••' : currentTime}
              </div>
            )}
          </div>

          {/* 4-Step Daily Shift Stepper */}
          <div className="grid grid-cols-4 gap-2">
            {shiftSlots.map((slot) => (
              <div
                key={slot.label}
                className={`p-2.5 pf-control-radius border text-center transition ${
                  slot.filled
                    ? 'pf-surface-muted pf-border-accent-solid'
                    : slot.isNext
                      ? 'pf-bg-accent-soft pf-border-accent'
                      : 'pf-surface-muted pf-border opacity-70'
                }`}
              >
                <div className="text-[10px] font-semibold pf-text-muted truncate">{slot.label}</div>
                <div
                  className={`text-xs sm:text-sm font-mono font-extrabold mt-0.5 tabular-nums ${
                    slot.filled ? 'pf-text-accent' : slot.isNext ? '' : 'pf-text-muted'
                  }`}
                >
                  {slot.time}
                </div>
              </div>
            ))}
          </div>

          {/* Execution Selector + Primary Action Stack */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-3 gap-1.5 p-1 pf-control-radius pf-surface-muted border pf-border">
              <button
                type="button"
                onClick={() => selectOption(true, 'visible')}
                title="Automático visível: mostra o navegador entrando no portal e clicando em Marcar ponto + Sim"
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  isAutoVisible ? 'pf-btn-accent shadow-sm' : 'pf-text-muted hover:opacity-90'
                }`}
              >
                <Bot className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <span className="hidden sm:inline">Auto · </span>Ao Vivo
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectOption(true, 'background')}
                title="Automático discreto: executa o login e a batida sem precisar assistir a tela do portal"
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  isAutoBackground ? 'pf-btn-accent shadow-sm' : 'pf-text-muted hover:opacity-90'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <span className="hidden sm:inline">Auto · </span>2º Plano
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectOption(false, autoVisibility)}
                title="Manual: faz login automático e deixa você clicar e salvar com o botão (✕)"
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  isManual ? 'pf-btn-accent shadow-sm' : 'pf-text-muted hover:opacity-90'
                }`}
              >
                <Hand className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Manual (✕)</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isPunching}
              onClick={onInitiatePunch}
              aria-label="Marcar ponto"
              className={`w-full py-3.5 px-6 pf-control-radius font-black text-sm sm:text-base transition-all transform duration-150 pf-btn-accent ${
                isPunching ? 'cursor-not-allowed opacity-75' : 'active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isPunching ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Conectando ao Portal...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isAutoBackground
                      ? 'Marcar ponto (2º Plano)'
                      : isManual
                        ? 'Abrir Portal (Manual)'
                        : 'Marcar ponto'}
                  </span>
                </span>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isPunching}
                onClick={onSimulatePunch}
                title="Registra uma batida de teste rápida para validar o alarme e o Banco de Horas"
                className="py-2 px-3 pf-control-radius text-[11px] font-bold pf-surface-muted hover:opacity-90 pf-text-accent border pf-border-accent transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>Simular Ponto</span>
              </button>

              <button
                type="button"
                disabled={isPunching}
                onClick={onTestPortalConnection}
                title="Entra no portal da Pernambucanas e valida login sem bater ponto"
                className="py-2 px-3 pf-control-radius text-[11px] font-bold pf-surface-muted hover:opacity-90 pf-text-secondary border pf-border transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 pf-text-accent shrink-0" />
                <span>Testar Conexão</span>
              </button>

              {onQuickManualPunch && (
                <button
                  type="button"
                  disabled={isPunching}
                  onClick={onQuickManualPunch}
                  title="Já bateu o ponto no relógio físico? Salve este horário agora"
                  className="py-2 px-3 pf-control-radius text-[11px] font-semibold pf-surface-muted hover:opacity-90 pf-text-secondary border pf-border transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 pf-text-accent shrink-0" />
                  <span>Batida Externa</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN (5 cols): Live Journey Card + Today's Timeline Card */}
        <section className="lg:col-span-5 pf-surface border pf-card-radius p-6 sm:p-7 flex flex-col justify-between space-y-5 shadow-xl">
          {/* Daily Journey Progress Summary */}
          <div className="space-y-3 pb-5 border-b pf-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 uppercase tracking-wider pf-text-muted">
                <Timer className="w-4 h-4 pf-text-accent" />
                <span>Progresso de Hoje</span>
              </span>
              <span className="text-lg font-black font-mono pf-text-accent tabular-nums">
                {formatMinutesToHours(prediction.workedMinutes, false)}
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${prediction.progressPercent}%`,
                  backgroundColor: 'var(--pf-accent)',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pf-text-muted tabular-nums">
              <span>
                Próx: <strong className="pf-text-secondary">{prediction.nextPunchLabel}</strong>
              </span>
              {prediction.predictedExitTimeStr ? (
                <span className="font-mono">
                  Saída est.:{' '}
                  <strong className="pf-text-accent">
                    {privacyMode ? '••:••' : prediction.predictedExitTimeStr}
                  </strong>
                </span>
              ) : (
                <span className="font-mono">
                  {prediction.isExtraDay
                    ? 'Dia extra'
                    : `Meta ${formatMinutesToHours(prediction.expectedMinutes, false)}`}
                </span>
              )}
            </div>
          </div>

          {/* Today's Timeline */}
          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold pf-text-muted uppercase tracking-wider">
                Marcações do dia · {punches.length} {punches.length === 1 ? 'registro' : 'registros'}
              </h3>

              {onVerifyPunchesToday && (
                <button
                  type="button"
                  disabled={isVerifyingPunches || isPunching}
                  onClick={onVerifyPunchesToday}
                  title="Consulta no site oficial da Pernambucanas os pontos batidos hoje"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 pf-control-radius text-[11px] font-bold pf-surface-muted border pf-border-accent pf-text-accent hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isVerifyingPunches ? 'animate-spin' : ''}`} />
                  <span>{isVerifyingPunches ? 'Consultando...' : 'Verificar portal'}</span>
                </button>
              )}
            </div>

            <div className="relative pl-6 space-y-3 flex-1">
              <div className="absolute left-2.5 top-2 bottom-2 w-0.5 pf-border border-l-2" />

              <div className="relative flex items-center gap-3">
                <div className="absolute -left-6 w-5 h-5 rounded-full pf-surface-solid border pf-border-accent-solid flex items-center justify-center pf-text-accent">
                  <Clock className="w-3 h-3" />
                </div>
                <span className="text-xs pf-text-muted">
                  Próxima: <strong className="pf-text-secondary">{prediction.nextPunchLabel}</strong>
                </span>
              </div>

              {sortedPunches.length === 0 ? (
                <div className="py-5 px-4 pf-surface-muted pf-control-radius border pf-border text-center space-y-3 my-2">
                  <div className="w-9 h-9 mx-auto rounded-full pf-bg-accent-soft border pf-border-accent flex items-center justify-center pf-text-accent">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold">Nenhum ponto registrado hoje ainda.</p>
                    <p className="text-[11px] pf-text-muted leading-relaxed">
                      Bateu no relógio físico ou portal? Consulte em 1 toque para sincronizar.
                    </p>
                  </div>
                  {onVerifyPunchesToday && (
                    <button
                      type="button"
                      disabled={isVerifyingPunches || isPunching}
                      onClick={onVerifyPunchesToday}
                      className="w-full py-2 px-3 pf-control-radius text-xs font-bold pf-btn-accent transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
                    >
                      <SearchCheck className="w-3.5 h-3.5" />
                      <span>Verificar batidas de hoje no portal</span>
                    </button>
                  )}
                </div>
              ) : (
                sortedPunches.map((punch) => {
                  const isConfirmed = punch.status === 'confirmado';
                  return (
                    <div
                      key={punch.id}
                      className="relative flex items-center justify-between group py-1.5 px-2 -ml-1 pf-control-radius hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-2">
                        <div className="absolute -left-6 w-5 h-5 rounded-full pf-surface-solid border pf-border-accent-solid flex items-center justify-center pf-text-accent">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>

                        <span className="text-sm font-bold font-mono tabular-nums tracking-wide">
                          {privacyMode ? '••:••' : punch.shortTime || punch.time}
                        </span>
                        {punch.isLunch && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded pf-bg-accent-soft pf-text-accent font-semibold">
                            Almoço
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold ${
                            isConfirmed
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isConfirmed ? '● Oficial' : '● Simulado'}
                        </span>

                        {onDeletePunch && (
                          <button
                            type="button"
                            onClick={() => onDeletePunch(punch.id)}
                            title="Remover este registro"
                            aria-label={`Remover batida ${punch.shortTime || punch.time}`}
                            className="opacity-60 sm:opacity-0 group-hover:opacity-100 p-1 rounded-md pf-text-muted hover:text-red-500 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {onViewBancoDeHoras && (
            <div className="pt-3 border-t pf-border flex items-center justify-between text-[11px]">
              <span className="pf-text-muted tabular-nums">
                Histórico total: <strong>{totalHistoryCount}</strong> registros
              </span>
              <button
                type="button"
                onClick={onViewBancoDeHoras}
                className="pf-text-accent font-bold hover:underline cursor-pointer"
              >
                Abrir Banco de Horas →
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
