import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  Sliders,
  Plus,
  FileSpreadsheet,
  Award,
  Info,
  Trash2,
  BarChart3,
  Eraser,
  Download,
  Upload,
  Calculator,
  AlertTriangle,
  RotateCcw,
  Scale,
  Printer,
} from 'lucide-react';
import {
  PunchRecord,
  WorkScheduleConfig,
  BancoDeHorasBaselineConfig,
  DEFAULT_BANCO_BASELINE,
  formatMinutesToHours,
  calculateDailyBalance,
  formatDateBrazilian,
  formatLocalRawDate,
  resolvePunchRawDate,
  calculateCombinedBankOfHours,
  BackupImportMode,
  ThemeColor,
} from '../utils/punch-rules';

interface BancoDeHorasPanelProps {
  punches: PunchRecord[];
  schedule: WorkScheduleConfig;
  baseline?: BancoDeHorasBaselineConfig;
  onUpdateSchedule: (newSchedule: WorkScheduleConfig) => void;
  onUpdateBaseline?: (newBaseline: BancoDeHorasBaselineConfig) => void;
  onAddManualPunch: (punch: Omit<PunchRecord, 'id'>) => void;
  onDeletePunch?: (id: string) => void;
  onClearSimulated?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: (file: File, mode?: BackupImportMode) => void;
  themeColor: ThemeColor;
  isDarkMode: boolean;
}

type DayFilter = 'all' | 'included' | 'extra' | 'simulated';

const WEEK_DAYS_NAMES = [
  { day: 0, label: 'Dom', full: 'Domingo' },
  { day: 1, label: 'Seg', full: 'Segunda-feira' },
  { day: 2, label: 'Ter', full: 'Terça-feira' },
  { day: 3, label: 'Qua', full: 'Quarta-feira' },
  { day: 4, label: 'Qui', full: 'Quinta-feira' },
  { day: 5, label: 'Sex', full: 'Sexta-feira' },
  { day: 6, label: 'Sáb', full: 'Sábado' },
];

export const BancoDeHorasPanel: React.FC<BancoDeHorasPanelProps> = ({
  punches,
  schedule,
  baseline = DEFAULT_BANCO_BASELINE,
  onUpdateSchedule,
  onUpdateBaseline,
  onAddManualPunch,
  onDeletePunch,
  onClearSimulated,
  onExportBackup,
  onImportBackup,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [showBaselineEditor, setShowBaselineEditor] = useState(false);
  const [showAddPunchModal, setShowAddPunchModal] = useState(false);
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Local state for schedule config
  const [localWorkStart, setLocalWorkStart] = useState(schedule.workStart);
  const [localWorkEnd, setLocalWorkEnd] = useState(schedule.workEnd);
  const [localLunchMinutes, setLocalLunchMinutes] = useState(schedule.lunchDurationMinutes);
  const [localWorkDays, setLocalWorkDays] = useState<number[]>(schedule.workDays);
  const [localCltTolerance, setLocalCltTolerance] = useState<boolean>(
    Boolean(schedule.cltToleranceEnabled)
  );

  React.useEffect(() => {
    setLocalWorkStart(schedule.workStart);
    setLocalWorkEnd(schedule.workEnd);
    setLocalLunchMinutes(schedule.lunchDurationMinutes);
    setLocalWorkDays(schedule.workDays);
    setLocalCltTolerance(Boolean(schedule.cltToleranceEnabled));
  }, [schedule]);

  // Local state for manual Banco de Horas baseline & cutoff date
  const [baseSign, setBaseSign] = useState<1 | -1>(() => (baseline.initialMinutes < 0 ? -1 : 1));
  const [baseHours, setBaseHours] = useState<number>(() =>
    Math.floor(Math.abs(baseline.initialMinutes || 0) / 60)
  );
  const [baseMins, setBaseMins] = useState<number>(() =>
    Math.abs(baseline.initialMinutes || 0) % 60
  );
  const [baseStartDate, setBaseStartDate] = useState<string>(baseline.startDateRaw || '');

  React.useEffect(() => {
    setBaseSign(baseline.initialMinutes < 0 ? -1 : 1);
    setBaseHours(Math.floor(Math.abs(baseline.initialMinutes || 0) / 60));
    setBaseMins(Math.abs(baseline.initialMinutes || 0) % 60);
    setBaseStartDate(baseline.startDateRaw || '');
  }, [baseline.initialMinutes, baseline.startDateRaw]);

  // Manual punch state
  const [manualTime, setManualTime] = useState('08:00');
  const [manualDate, setManualDate] = useState(() => formatLocalRawDate(new Date()));
  const [manualType, setManualType] = useState<PunchRecord['type']>('entrada');
  const [manualStatus, setManualStatus] = useState<PunchRecord['status']>('confirmado');

  const today = useMemo(() => new Date(), []);
  const todayRaw = formatLocalRawDate(today);
  const todayKey = formatDateBrazilian(today);

  // Group punches by canonical date key (rawDate when available, else dateStr)
  const punchesByDate = useMemo(() => {
    return punches.reduce<Record<string, { dateLabel: string; rawDate: string | null; items: PunchRecord[] }>>(
      (acc, punch) => {
        const raw = resolvePunchRawDate([punch], punch.dateStr || '');
        const groupKey = raw || punch.dateStr || todayKey;
        const displayLabel = punch.dateStr || (raw === todayRaw ? todayKey : groupKey);
        if (!acc[groupKey]) {
          acc[groupKey] = { dateLabel: displayLabel, rawDate: raw, items: [] };
        }
        acc[groupKey].items.push(punch);
        return acc;
      },
      {}
    );
  }, [punches, todayKey, todayRaw]);

  const todayPunches = punchesByDate[todayRaw]?.items || punchesByDate[todayKey]?.items || [];
  const todayBalance = calculateDailyBalance(todayPunches, schedule, today, today);

  // Compute daily summaries sorted chronologically (newest first)
  const dailySummaries = useMemo(() => {
    const list = Object.entries(punchesByDate).map(([, group]) => {
      const raw = group.rawDate || resolvePunchRawDate(group.items, group.dateLabel);
      let refDate = today;
      if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        refDate = new Date(y, m - 1, d, 12, 0, 0);
      }
      const isToday = raw ? raw === todayRaw : group.dateLabel === todayKey;
      const balance = calculateDailyBalance(
        group.items,
        schedule,
        refDate,
        isToday ? today : undefined
      );
      const hasSimulated = group.items.some((p) => p.status === 'simulado');
      const isOddIncomplete = group.items.length % 2 !== 0 && !isToday;

      return {
        dateLabel: group.dateLabel,
        rawDate: raw,
        isToday,
        dayPunches: group.items,
        balance,
        hasSimulated,
        isOddIncomplete,
      };
    });

    list.sort((a, b) => (b.rawDate || '').localeCompare(a.rawDate || ''));
    return list;
  }, [punchesByDate, schedule, todayKey, todayRaw, today]);

  // Combined balance with saved manual baseline + startDateRaw cutoff
  const combinedBank = useMemo(() => {
    const cutoff = (baseline.startDateRaw || '').trim();
    const res = calculateCombinedBankOfHours(
      dailySummaries.map((d) => ({
        rawDate: d.rawDate,
        balanceMinutes: d.balance.balanceMinutes,
      })),
      baseline
    );
    return { ...res, cutoff };
  }, [dailySummaries, baseline]);

  // Live preview inside the editor before clicking "Aplicar Medição"
  const draftInitialMinutes = useMemo(() => {
    const safeH = Math.max(0, Math.min(999, Math.trunc(Number(baseHours) || 0)));
    const safeM = Math.max(0, Math.min(59, Math.trunc(Number(baseMins) || 0)));
    return baseSign * (safeH * 60 + safeM);
  }, [baseSign, baseHours, baseMins]);

  const draftCombinedPreview = useMemo(() => {
    return calculateCombinedBankOfHours(
      dailySummaries.map((d) => ({
        rawDate: d.rawDate,
        balanceMinutes: d.balance.balanceMinutes,
      })),
      { initialMinutes: draftInitialMinutes, startDateRaw: baseStartDate }
    );
  }, [dailySummaries, draftInitialMinutes, baseStartDate]);

  const enrichedSummaries = useMemo(() => {
    const cutoff = combinedBank.cutoff;
    return dailySummaries.map((d) => ({
      ...d,
      isIncludedInBalance: !cutoff || (d.rawDate !== null && d.rawDate >= cutoff),
    }));
  }, [dailySummaries, combinedBank.cutoff]);

  const filteredSummaries = useMemo(() => {
    if (dayFilter === 'included') {
      return enrichedSummaries.filter((d) => d.isIncludedInBalance);
    }
    if (dayFilter === 'extra') {
      return enrichedSummaries.filter((d) => d.balance.isExtraDay || d.balance.balanceMinutes > 0);
    }
    if (dayFilter === 'simulated') {
      return enrichedSummaries.filter((d) => d.hasSimulated);
    }
    return enrichedSummaries;
  }, [enrichedSummaries, dayFilter]);

  const simulatedCount = punches.filter((p) => p.status === 'simulado').length;
  const totalBalanceMinutes = combinedBank.totalCombinedMinutes;
  const isBalancePositive = totalBalanceMinutes >= 0;
  const hasBaselineActive =
    baseline.initialMinutes !== 0 || Boolean((baseline.startDateRaw || '').trim());

  // Toggle work day
  const toggleWorkDay = (day: number) => {
    if (localWorkDays.includes(day)) {
      setLocalWorkDays(localWorkDays.filter((d) => d !== day));
    } else {
      setLocalWorkDays([...localWorkDays, day].sort());
    }
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSchedule({
      workStart: localWorkStart,
      workEnd: localWorkEnd,
      lunchDurationMinutes: Number(localLunchMinutes) || 60,
      workDays: localWorkDays,
      cltToleranceEnabled: localCltTolerance,
    });
    setShowConfig(false);
  };

  const handleSaveBaseline = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateBaseline) {
      onUpdateBaseline({
        initialMinutes: draftInitialMinutes,
        startDateRaw: baseStartDate.trim(),
      });
    }
    setShowBaselineEditor(false);
  };

  const handleResetBaseline = () => {
    setBaseSign(1);
    setBaseHours(0);
    setBaseMins(0);
    setBaseStartDate('');
    if (onUpdateBaseline) {
      onUpdateBaseline({ initialMinutes: 0, startDateRaw: '' });
    }
  };

  const formatBrShortDate = (raw: string) => {
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleCreateManualPunch = (e: React.FormEvent) => {
    e.preventDefault();
    const [y, m, d] = manualDate.split('-').map(Number);
    const localDateObj = new Date(y, m - 1, d, 12, 0, 0);
    onAddManualPunch({
      time: `${manualTime}:00`,
      shortTime: manualTime,
      dateStr: formatDateBrazilian(localDateObj),
      isLunch: manualType === 'almoco_ida' || manualType === 'almoco_volta',
      type: manualType,
      status: manualStatus,
      rawDate: manualDate,
    });
    setShowAddPunchModal(false);
  };

  const handleExportCSV = () => {
    const rows = [
      ['Data', 'Horario', 'Tipo', 'Status', 'Almoco'].join(';'),
      ...punches.map((p) =>
        [p.dateStr, p.shortTime || p.time, p.type, p.status, p.isLunch ? 'Sim' : 'Nao'].join(';')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `banco_de_horas_pernambucanas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const recentChartDays = dailySummaries.slice(0, 7).reverse();
  const maxChartMinutes = Math.max(
    480,
    ...recentChartDays.map((d) => Math.max(d.balance.workedMinutes, d.balance.expectedMinutes))
  );

  return (
    <div className="w-full max-w-6xl pf-surface border pf-card-radius p-6 sm:p-8 shadow-xl relative transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-col gap-4 pb-6 border-b pf-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 pf-bg-accent pf-control-radius shadow-sm shrink-0">
                <TrendingUp className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Painel Profissional de Banco de Horas
              </h2>
            </div>
            <p className="text-xs pf-text-muted mt-1">
              Cálculo em tempo real de jornada diária, tolerância CLT, compensações e exportação
            </p>
          </div>
        </div>

        <div className="pf-no-print flex flex-wrap items-center gap-2">
          {onExportBackup && (
            <button
              type="button"
              onClick={onExportBackup}
              title="Exportar batidas, banco e configurações em arquivo .json para outro dispositivo"
              className="flex items-center gap-1.5 px-3 py-2 pf-surface-muted hover:opacity-90 pf-text-secondary pf-control-radius text-xs font-semibold border pf-border transition cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 pf-text-accent" />
              <span>Exportar .json</span>
            </button>
          )}

          {onImportBackup && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportBackup(file, 'merge');
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Importar marcações e configurações de um arquivo .json (mescla sem duplicar)"
                className="flex items-center gap-1.5 px-3 py-2 pf-surface-muted hover:opacity-90 pf-text-secondary pf-control-radius text-xs font-semibold border pf-border transition cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 pf-text-accent" />
                <span>Importar .json</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            title="Exportar registros de ponto em formato CSV"
            className="flex items-center gap-1.5 px-3 py-2 pf-surface-muted hover:opacity-90 pf-text-secondary pf-control-radius text-xs font-semibold border pf-border transition cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            title="Imprimir ou salvar Espelho de Ponto em PDF"
            className="flex items-center gap-1.5 px-3 py-2 pf-surface-muted hover:opacity-90 pf-text-secondary pf-control-radius text-xs font-semibold border pf-border transition cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 pf-text-accent" />
            <span className="hidden sm:inline">Espelho PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddPunchModal(true)}
            title="Adicionar ponto manual ao banco de horas"
            className="flex items-center gap-1.5 px-3 py-2 pf-surface-muted hover:opacity-90 pf-text-secondary pf-control-radius text-xs font-semibold border pf-border transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 pf-text-accent" />
            <span>Adicionar Ponto</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowConfig(false);
              setShowBaselineEditor((v) => !v);
            }}
            title="Informar quanto estava seu banco de horas na última medição e a partir de qual data somar"
            className={`flex items-center gap-1.5 px-3.5 py-2 pf-control-radius text-xs font-bold border transition cursor-pointer whitespace-nowrap ${
              showBaselineEditor || hasBaselineActive
                ? 'pf-bg-accent-soft pf-text-accent pf-border-accent hover:opacity-90'
                : 'pf-surface-muted pf-text-secondary pf-border hover:opacity-90'
            }`}
          >
            <Calculator className="w-4 h-4 pf-text-accent" />
            <span>Medição Anterior</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowBaselineEditor(false);
              setShowConfig(!showConfig);
            }}
            title="Configurar horários de jornada e dias de trabalho"
            className={`flex items-center gap-1.5 px-3.5 py-2 pf-control-radius text-xs font-bold border transition cursor-pointer whitespace-nowrap ${
              showConfig
                ? 'pf-btn-accent border-transparent'
                : 'pf-surface-muted pf-text-accent pf-border-accent hover:opacity-90'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Configurar Escala</span>
          </button>
        </div>
      </div>

      {/* Embedded Work Schedule Configuration */}
      {showConfig && (
        <form
          onSubmit={handleSaveSchedule}
          className="my-6 p-5 pf-surface-muted border-2 pf-border-accent rounded-2xl animate-in fade-in duration-200 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 pf-text-accent font-bold text-sm">
              <Sliders className="w-4 h-4" />
              <span>Configuração da Sua Jornada de Trabalho</span>
            </div>
            <span className="text-[11px] pf-text-muted">
              Personalize para cálculo exato de horas extras
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider pf-text-secondary mb-2">
              Dias da Semana em que Trabalha (Escala Regular)
            </label>
            <div className="grid grid-cols-7 gap-2">
              {WEEK_DAYS_NAMES.map(({ day, label, full }) => {
                const isSelected = localWorkDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWorkDay(day)}
                    title={full}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'pf-btn-accent border-transparent'
                        : 'pf-surface pf-text-muted pf-border hover:opacity-90'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] pf-text-muted mt-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 pf-text-accent shrink-0" />
              <span>
                <strong>Regra configurada:</strong> Qualquer dia não selecionado acima (ex: sábado ou domingo) é considerado folga integral — todo ponto batido neles contará <strong>100% como banco de horas extra</strong>!
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs pf-text-secondary mb-1 font-semibold">
                Horário de Entrada Previsto
              </label>
              <input
                type="time"
                value={localWorkStart}
                onChange={(e) => setLocalWorkStart(e.target.value)}
                className="w-full px-3.5 py-2 pf-surface border pf-border rounded-xl font-mono text-sm pf-ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs pf-text-secondary mb-1 font-semibold">
                Horário de Saída Previsto
              </label>
              <input
                type="time"
                value={localWorkEnd}
                onChange={(e) => setLocalWorkEnd(e.target.value)}
                className="w-full px-3.5 py-2 pf-surface border pf-border rounded-xl font-mono text-sm pf-ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs pf-text-secondary mb-1 font-semibold">
                Tempo Previsto de Almoço
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={localLunchMinutes}
                  onChange={(e) => setLocalLunchMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-2 pf-surface border pf-border rounded-xl font-mono text-sm pf-ring-accent text-center"
                />
                <span className="text-xs pf-text-muted">min</span>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2.5 p-3.5 pf-surface border pf-border rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={localCltTolerance}
              onChange={(e) => setLocalCltTolerance(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded"
              style={{ accentColor: 'var(--pf-accent)' }}
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Scale className="w-3.5 h-3.5 pf-text-accent" />
                <span>Tolerância CLT (Art. 58 § 1º — ±10 min diários)</span>
              </div>
              <p className="text-[11px] pf-text-muted leading-snug">
                Quando marcada, saldos diários fechados dentro de <strong>±10 minutos</strong> são zerados automaticamente no cálculo do banco de horas (ex: -7 min ou +8 min viram 00h 00m).
              </p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 text-xs font-semibold pf-text-muted hover:opacity-80 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 pf-btn-accent font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Salvar Escala de Trabalho
            </button>
          </div>
        </form>
      )}

      {/* Embedded Manual Banco Baseline + Cutoff Date Panel */}
      {showBaselineEditor && (
        <form
          onSubmit={handleSaveBaseline}
          className="my-6 p-5 pf-surface-muted border-2 pf-border-accent rounded-2xl space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 pf-text-accent font-bold text-sm">
              <Calculator className="w-4 h-4" />
              <span>Saldo da Última Medição &amp; Data de Início da Soma</span>
            </div>
            <span className="text-[11px] pf-text-muted">
              Dias anteriores à data escolhida não serão somados ao saldo abaixo
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Tipo (+ Crédito / - Débito) */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-xs pf-text-secondary font-semibold">
                Situação do Banco Anterior
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 pf-surface border pf-border rounded-xl">
                <button
                  type="button"
                  onClick={() => setBaseSign(1)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    baseSign === 1
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                      : 'pf-text-muted'
                  }`}
                >
                  + Positivo
                </button>
                <button
                  type="button"
                  onClick={() => setBaseSign(-1)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    baseSign === -1
                      ? 'bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/40'
                      : 'pf-text-muted'
                  }`}
                >
                  − Negativo
                </button>
              </div>
            </div>

            {/* Horas e Minutos */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-xs pf-text-secondary font-semibold">
                Quanto Estava Seu Banco
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1.5 pf-surface border pf-border rounded-xl px-3 py-1.5">
                  <input
                    type="number"
                    min="0"
                    max="999"
                    aria-label="Horas da última medição"
                    value={baseHours}
                    onChange={(e) => setBaseHours(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-transparent font-mono font-bold text-sm text-center focus:outline-none"
                  />
                  <span className="text-xs font-bold pf-text-muted">h</span>
                </div>
                <div className="flex-1 flex items-center gap-1.5 pf-surface border pf-border rounded-xl px-3 py-1.5">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    aria-label="Minutos da última medição"
                    value={baseMins}
                    onChange={(e) => setBaseMins(Math.min(59, Math.max(0, Number(e.target.value))))}
                    className="w-full bg-transparent font-mono font-bold text-sm text-center focus:outline-none"
                  />
                  <span className="text-xs font-bold pf-text-muted">m</span>
                </div>
              </div>
            </div>

            {/* Data de corte */}
            <div className="md:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs pf-text-secondary font-semibold">
                  Somar App a Partir de (Data)
                </label>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setBaseStartDate(todayRaw)}
                    className="pf-text-accent hover:underline cursor-pointer"
                  >
                    Hoje
                  </button>
                  {baseStartDate && (
                    <button
                      type="button"
                      onClick={() => setBaseStartDate('')}
                      className="pf-text-muted hover:underline cursor-pointer"
                    >
                      Todas as datas
                    </button>
                  )}
                </div>
              </div>
              <input
                type="date"
                aria-label="Data inicial para somar marcações do app"
                value={baseStartDate}
                onChange={(e) => setBaseStartDate(e.target.value)}
                className="w-full px-3.5 py-2 pf-surface border pf-border rounded-xl font-mono text-sm pf-ring-accent"
              />
            </div>
          </div>

          {/* Live Formula Preview */}
          <div className="p-3.5 pf-surface border pf-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold">
                Prévia:{' '}
                <span className="font-mono font-bold pf-text-accent">
                  {formatMinutesToHours(draftInitialMinutes)}
                </span>{' '}
                (medição) +{' '}
                <span className="font-mono font-bold">
                  {formatMinutesToHours(draftCombinedPreview.appAccumulatedMinutes)}
                </span>{' '}
                (app{baseStartDate ? ` desde ${formatBrShortDate(baseStartDate)}` : ' completo'}) ={' '}
                <strong
                  className={`font-mono ${
                    draftCombinedPreview.totalCombinedMinutes >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatMinutesToHours(draftCombinedPreview.totalCombinedMinutes)}
                </strong>
              </div>
              {draftCombinedPreview.ignoredDaysCount > 0 && (
                <p className="text-[11px] pf-text-muted">
                  {draftCombinedPreview.ignoredDaysCount}{' '}
                  {draftCombinedPreview.ignoredDaysCount === 1
                    ? 'dia anterior a esta data será ignorado'
                    : 'dias anteriores a esta data serão ignorados'}{' '}
                  na soma ({formatMinutesToHours(draftCombinedPreview.ignoredBeforeCutoffMinutes)}).
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetBaseline}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold pf-text-muted hover:opacity-80 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Zerar</span>
              </button>
              <button
                type="submit"
                className="px-4 py-2 pf-btn-accent font-bold text-xs rounded-xl cursor-pointer transition"
              >
                Aplicar Medição
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Main Metrics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="pf-surface-muted p-5 rounded-2xl border pf-border flex flex-col justify-between">
          <div className="flex items-center justify-between pf-text-muted text-xs">
            <span className="font-semibold uppercase tracking-wider">Saldo Geral de Banco</span>
            {isBalancePositive ? (
              <span className="p-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <TrendingUp className="w-4 h-4" />
              </span>
            ) : (
              <span className="p-1 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25">
                <TrendingDown className="w-4 h-4" />
              </span>
            )}
          </div>

          <div className="my-2">
            <div
              className={`text-3xl sm:text-4xl font-black font-mono tracking-tight tabular-nums ${
                isBalancePositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatMinutesToHours(totalBalanceMinutes)}
            </div>

            {hasBaselineActive ? (
              <p className="text-[11px] pf-text-muted mt-1 leading-relaxed">
                Medição{' '}
                <strong className="font-mono pf-text-secondary">
                  {formatMinutesToHours(combinedBank.initialMinutes)}
                </strong>{' '}
                + App{' '}
                {combinedBank.cutoff ? `desde ${formatBrShortDate(combinedBank.cutoff)}` : 'total'}{' '}
                <strong className="font-mono pf-text-secondary">
                  {formatMinutesToHours(combinedBank.appAccumulatedMinutes)}
                </strong>
              </p>
            ) : (
              <p className="text-[11px] pf-text-muted mt-1">
                {totalBalanceMinutes > 0
                  ? `Crédito de ${formatMinutesToHours(totalBalanceMinutes, false)} disponível para folga ou saída antecipada.`
                  : totalBalanceMinutes < 0
                    ? `Saldo devedor de ${formatMinutesToHours(Math.abs(totalBalanceMinutes), false)} para compensação.`
                    : 'Banco de horas equilibrado (00h 00m).'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setShowConfig(false);
                setShowBaselineEditor((v) => !v);
              }}
              className="pf-no-print text-[11px] font-bold pf-text-accent hover:underline text-left cursor-pointer w-fit"
            >
              {hasBaselineActive ? 'Editar medição anterior →' : '+ Informar saldo da última medição'}
            </button>
            {schedule.cltToleranceEnabled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full pf-bg-accent-soft pf-text-accent border pf-border-accent">
                <Scale className="w-3 h-3" />
                <span>CLT ±10m ativa</span>
              </span>
            )}
          </div>
        </div>

        <div className="pf-surface-muted p-5 rounded-2xl border pf-border flex flex-col justify-between">
          <div className="flex items-center justify-between pf-text-muted text-xs">
            <span className="font-semibold uppercase tracking-wider">Hoje (Jornada Diária)</span>
            <Clock className="w-4 h-4 pf-text-accent" />
          </div>

          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight tabular-nums">
              {formatMinutesToHours(todayBalance.workedMinutes, false)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px]">
              <span className="pf-text-muted">Meta:</span>
              <span className="font-mono font-bold pf-text-secondary">
                {todayBalance.isExtraDay
                  ? 'Folga (100% Extra)'
                  : formatMinutesToHours(todayBalance.expectedMinutes, false)}
              </span>
              {todayBalance.inProgress && (
                <span className="text-[10px] px-1.5 py-0.5 pf-bg-accent-soft pf-text-accent rounded font-semibold">
                  Em andamento
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pf-surface-muted p-5 rounded-2xl border pf-border flex flex-col justify-between">
          <div className="flex items-center justify-between pf-text-muted text-xs">
            <span className="font-semibold uppercase tracking-wider">Saldo de Hoje</span>
            <Award className="w-4 h-4 pf-text-accent" />
          </div>

          <div className="my-2">
            <div
              className={`text-3xl sm:text-4xl font-black font-mono tracking-tight tabular-nums ${
                todayBalance.balanceMinutes >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatMinutesToHours(todayBalance.balanceMinutes)}
            </div>
            <p className="text-[11px] pf-text-muted mt-1">
              {todayBalance.isExtraDay
                ? 'Dia de folga/fim de semana (extra total)'
                : 'Horas trabalhadas menos jornada prevista'}
            </p>
          </div>
        </div>
      </div>

      {/* Compensation / Cutoff Summary Strip when baseline or history exists */}
      {(hasBaselineActive || combinedBank.ignoredDaysCount > 0) && (
        <div className="mb-6 px-4 py-3 pf-surface-muted border pf-border rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 pf-text-accent shrink-0" />
            <span>
              Somando <strong>{combinedBank.includedDaysCount}</strong>{' '}
              {combinedBank.includedDaysCount === 1 ? 'dia' : 'dias'}
              {combinedBank.cutoff ? (
                <>
                  {' '}a partir de <strong>{formatBrShortDate(combinedBank.cutoff)}</strong>
                </>
              ) : null}{' '}
              ao saldo medido de{' '}
              <strong className="font-mono">{formatMinutesToHours(combinedBank.initialMinutes)}</strong>.
              {combinedBank.ignoredDaysCount > 0 && (
                <span className="pf-text-muted">
                  {' '}({combinedBank.ignoredDaysCount}{' '}
                  {combinedBank.ignoredDaysCount === 1 ? 'dia anterior ignorado' : 'dias anteriores ignorados'}).
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowBaselineEditor(true)}
            className="pf-text-accent font-bold text-[11px] hover:underline cursor-pointer"
          >
            Alterar data/valor
          </button>
        </div>
      )}

      {/* Recent Days Visual Comparison Bar Chart */}
      {recentChartDays.length > 0 && (
        <div className="mb-6 p-4 pf-surface-muted rounded-2xl border pf-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider pf-text-secondary">
              <BarChart3 className="w-4 h-4 pf-text-accent" />
              <span>Desempenho Diário (Trabalhado vs Meta)</span>
            </div>
            <span className="text-[10px] font-mono pf-text-muted">
              Últimos {recentChartDays.length} {recentChartDays.length === 1 ? 'dia' : 'dias'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-1">
            {recentChartDays.map((item) => {
              const workedPct = Math.min(100, Math.round((item.balance.workedMinutes / maxChartMinutes) * 100));
              const parts = item.dateLabel.split(' de ');
              const shortLabel =
                parts.length >= 2 ? `${parts[0]}/${parts[1].slice(0, 3)}` : item.dateLabel.slice(0, 6);
              const isPos = item.balance.balanceMinutes >= 0;

              return (
                <div
                  key={item.dateLabel}
                  className="pf-surface border pf-border rounded-xl p-2.5 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono whitespace-nowrap">
                    <span className="font-bold">{shortLabel}</span>
                    <span className={isPos ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                      {formatMinutesToHours(item.balance.balanceMinutes)}
                    </span>
                  </div>
                  <div className="w-full h-14 flex items-end bg-black/5 dark:bg-white/5 rounded-lg p-1 overflow-hidden">
                    <div
                      className="w-full rounded-md transition-all duration-500"
                      style={{
                        height: `${Math.max(12, workedPct)}%`,
                        backgroundColor: 'var(--pf-accent)',
                      }}
                    />
                  </div>
                  <div className="text-[10px] font-mono pf-text-muted text-center">
                    {formatMinutesToHours(item.balance.workedMinutes, false)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Punches Timeline and Detailed List */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider pf-text-secondary">
            Detalhamento por Data e Batidas
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter pills */}
            <div className="inline-flex flex-wrap items-center p-1 rounded-xl pf-surface-muted border pf-border text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setDayFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  dayFilter === 'all' ? 'pf-btn-accent' : 'pf-text-muted'
                }`}
              >
                Todos ({dailySummaries.length})
              </button>
              {combinedBank.cutoff && (
                <button
                  type="button"
                  onClick={() => setDayFilter('included')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    dayFilter === 'included' ? 'pf-btn-accent' : 'pf-text-muted'
                  }`}
                >
                  No Saldo ({combinedBank.includedDaysCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setDayFilter('extra')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  dayFilter === 'extra' ? 'pf-btn-accent' : 'pf-text-muted'
                }`}
              >
                Extras / Folgas
              </button>
              <button
                type="button"
                onClick={() => setDayFilter('simulated')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  dayFilter === 'simulated' ? 'pf-btn-accent' : 'pf-text-muted'
                }`}
              >
                Simulados
              </button>
            </div>

            {onClearSimulated && simulatedCount > 0 && (
              <button
                type="button"
                onClick={onClearSimulated}
                title="Remove todos os registros de simulação de teste"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Limpar Simulados ({simulatedCount})</span>
              </button>
            )}
          </div>
        </div>

        {filteredSummaries.length === 0 ? (
          <div className="p-8 text-center pf-surface-muted rounded-2xl border pf-border">
            <Clock className="w-8 h-8 pf-text-muted mx-auto mb-2" />
            <p className="text-sm font-medium">
              {punches.length === 0
                ? 'Nenhum ponto registrado ainda.'
                : 'Nenhum dia corresponde ao filtro selecionado.'}
            </p>
            <p className="text-xs pf-text-muted mt-1">
              Bata o ponto ou utilize o botão 'Adicionar Ponto' para alimentar seu banco de horas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSummaries.map(({ dateLabel, rawDate, dayPunches, balance, isIncludedInBalance, isOddIncomplete }) => {
              const isPositive = balance.balanceMinutes >= 0;

              return (
                <div
                  key={rawDate || dateLabel}
                  className={`pf-surface-muted p-4 rounded-2xl border pf-border transition ${
                    !isIncludedInBalance ? 'opacity-65' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b pf-border">
                    <div className="flex flex-wrap items-center gap-2">
                      <Calendar className="w-4 h-4 pf-text-accent" />
                      <span className="text-sm font-bold capitalize">{dateLabel}</span>
                      {balance.isExtraDay && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full pf-bg-accent-soft pf-text-accent border pf-border-accent font-bold">
                          Folga / 100% Extra
                        </span>
                      )}
                      {!isIncludedInBalance && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full pf-surface pf-text-muted border pf-border font-semibold">
                          Anterior ao corte (não somado)
                        </span>
                      )}
                      {balance.withinCltTolerance && (
                        <span
                          title={`Variação real (${formatMinutesToHours(balance.rawBalanceMinutes)}) dentro da tolerância legal de ±10 minutos (CLT Art. 58 § 1º)`}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 font-bold"
                        >
                          <Scale className="w-3 h-3" />
                          <span>Tolerância CLT (±10m)</span>
                        </span>
                      )}
                      {isOddIncomplete && (
                        <button
                          type="button"
                          onClick={() => {
                            if (rawDate) setManualDate(rawDate);
                            setManualType(dayPunches.length === 1 ? 'almoco_ida' : 'saida');
                            setShowAddPunchModal(true);
                          }}
                          className="pf-no-print inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35 font-bold cursor-pointer hover:opacity-90"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Marcação ímpar · + Completar</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="pf-text-muted">Trabalhado: </span>
                        <strong>{formatMinutesToHours(balance.workedMinutes, false)}</strong>
                      </div>
                      <div>
                        <span className="pf-text-muted">Saldo: </span>
                        <strong
                          className={
                            isPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {formatMinutesToHours(balance.balanceMinutes)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Badges of punches */}
                  <div className="flex flex-wrap gap-2 pt-3">
                    {dayPunches.map((punch) => (
                      <div
                        key={punch.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl pf-surface border pf-border text-xs group"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            punch.status === 'confirmado' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <span className="font-mono font-bold">
                          {punch.shortTime || punch.time}
                        </span>
                        {punch.isLunch && (
                          <span className="text-[10px] pf-text-accent pf-bg-accent-soft px-1.5 py-0.5 rounded font-semibold">
                            Almoço
                          </span>
                        )}
                        <span className="text-[10px] pf-text-muted">
                          {punch.status === 'simulado' ? 'Sim' : 'Ofic'}
                        </span>
                        {onDeletePunch && (
                          <button
                            type="button"
                            onClick={() => onDeletePunch(punch.id)}
                            title="Excluir batida"
                            className="pf-text-muted hover:text-red-500 transition cursor-pointer ml-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Manual Punch Modal */}
      {showAddPunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md pf-surface border pf-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold mb-1">Adicionar Ponto Manual</h3>
            <p className="text-xs pf-text-muted mb-4">
              Acrescente batidas retroativas para alimentar seu banco de horas.
            </p>

            <form onSubmit={handleCreateManualPunch} className="space-y-4">
              <div>
                <label className="block text-xs pf-text-secondary mb-1 font-semibold">Data</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3.5 py-2 pf-surface-muted border pf-border rounded-xl text-sm pf-ring-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs pf-text-secondary mb-1 font-semibold">Horário (HH:mm)</label>
                <input
                  type="time"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  className="w-full px-3.5 py-2 pf-surface-muted border pf-border rounded-xl font-mono text-sm pf-ring-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs pf-text-secondary mb-1 font-semibold">Tipo de Batida</label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as PunchRecord['type'])}
                    className="w-full px-3 py-2 pf-surface-muted border pf-border rounded-xl text-xs pf-ring-accent"
                  >
                    <option value="entrada">Entrada</option>
                    <option value="almoco_ida">Almoço (Ida)</option>
                    <option value="almoco_volta">Almoço (Volta)</option>
                    <option value="saida">Saída</option>
                    <option value="avulso">Avulso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs pf-text-secondary mb-1 font-semibold">Status</label>
                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as PunchRecord['status'])}
                    className="w-full px-3 py-2 pf-surface-muted border pf-border rounded-xl text-xs pf-ring-accent"
                  >
                    <option value="confirmado">Confirmado</option>
                    <option value="simulado">Simulado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddPunchModal(false)}
                  className="px-4 py-2 text-xs font-semibold pf-text-muted hover:opacity-80 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 pf-btn-accent font-bold text-xs rounded-xl cursor-pointer"
                >
                  Salvar Batida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
