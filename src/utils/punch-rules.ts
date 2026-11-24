/**
 * Logic and pure functions for PontoFácil Pernambucanas
 * Including Banco de Horas calculations, Themes and Sounds
 */

export interface PunchRecord {
  id: string;
  time: string; // e.g. "12:59:45"
  shortTime: string; // e.g. "12:59"
  dateStr: string; // e.g. "10 de novembro de 2026 - ter"
  isLunch: boolean;
  type: 'entrada' | 'almoco_ida' | 'almoco_volta' | 'saida' | 'avulso';
  status: 'confirmado' | 'simulado' | 'falha';
  note?: string;
  rawDate?: string; // YYYY-MM-DD
}

export type ThemeColor =
  | 'yellow'
  | 'green'
  | 'red'
  | 'blue'
  | 'purple'
  | 'orange'
  | 'teal'
  | 'pink'
  | 'onyx'
  | 'graphite'
  | 'navy'
  | 'forest'
  | 'wine'
  | 'indigo'
  | 'espresso'
  | 'petrol'
  | 'custom';

export interface ThemePaletteItem {
  id: Exclude<ThemeColor, 'custom'>;
  name: string;
  hex: string;
  darkHex: string;
  group: 'vibrant' | 'dark-light';
}

export const CURATED_THEME_PALETTES: ThemePaletteItem[] = [
  // Cores Vibrantes (Clássicas)
  { id: 'yellow', name: 'Amarelo', hex: '#eab308', darkHex: '#facc15', group: 'vibrant' },
  { id: 'green', name: 'Verde', hex: '#059669', darkHex: '#10b981', group: 'vibrant' },
  { id: 'blue', name: 'Azul', hex: '#0284c7', darkHex: '#38bdf8', group: 'vibrant' },
  { id: 'red', name: 'Vermelho', hex: '#dc2626', darkHex: '#ef4444', group: 'vibrant' },
  { id: 'purple', name: 'Roxo', hex: '#7c3aed', darkHex: '#a855f7', group: 'vibrant' },
  { id: 'orange', name: 'Laranja', hex: '#ea580c', darkHex: '#fb923c', group: 'vibrant' },
  { id: 'teal', name: 'Turquesa', hex: '#0d9488', darkHex: '#2dd4bf', group: 'vibrant' },
  { id: 'pink', name: 'Rosa', hex: '#db2777', darkHex: '#f472b6', group: 'vibrant' },
  // Cores Escuras (Ideais para Tema Claro)
  { id: 'onyx', name: 'Ônix', hex: '#0f172a', darkHex: '#e2e8f0', group: 'dark-light' },
  { id: 'graphite', name: 'Grafite', hex: '#334155', darkHex: '#94a3b8', group: 'dark-light' },
  { id: 'navy', name: 'Marinho', hex: '#1e3a8a', darkHex: '#60a5fa', group: 'dark-light' },
  { id: 'forest', name: 'Musgo', hex: '#14532d', darkHex: '#4ade80', group: 'dark-light' },
  { id: 'wine', name: 'Vinho', hex: '#881337', darkHex: '#fb7185', group: 'dark-light' },
  { id: 'indigo', name: 'Índigo', hex: '#312e81', darkHex: '#818cf8', group: 'dark-light' },
  { id: 'espresso', name: 'Café', hex: '#451a03', darkHex: '#f59e0b', group: 'dark-light' },
  { id: 'petrol', name: 'Petróleo', hex: '#115e59', darkHex: '#2dd4bf', group: 'dark-light' },
];
export type ThemeMode = 'dark' | 'light';
export type BackgroundStyle =
  | 'matrix'
  | 'constellation'
  | 'waves'
  | 'hexgrid'
  | 'starfield'
  | 'grid'
  | 'aurora'
  | 'minimal';
export type ClockStyle = 'digital' | 'segmented' | 'analog' | 'minimal' | 'progress';
export type SurfaceStyle = 'glass' | 'solid' | 'outline';
export type RadiusStyle = 'sharp' | 'balanced' | 'soft';
export type BackdropSpeed = 'slow' | 'normal' | 'fast';
export type AutoVisibility = 'visible' | 'background';
export type AlarmSoundId = 'notification' | 'classic' | 'digital' | 'bell' | 'cyber' | 'energetic';

export interface VisualThemeConfig {
  themeColor: ThemeColor;
  customAccentHex: string;
  isDarkMode: boolean;
  backgroundStyle: BackgroundStyle;
  clockStyle: ClockStyle;
  surfaceStyle: SurfaceStyle;
  radiusStyle: RadiusStyle;
  backdropSpeed: BackdropSpeed;
  backdropInteractive: boolean;
  matrixEnabled: boolean;
  matrixOpacity: number;
}

export interface WorkScheduleConfig {
  workDays: number[]; // 0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua, 4 = Qui, 5 = Sex, 6 = Sáb
  workStart: string; // e.g. "08:00"
  workEnd: string; // e.g. "17:48" or "18:00"
  lunchDurationMinutes: number; // e.g. 60 (1 hora) ou 59
  cltToleranceEnabled?: boolean; // Art. 58 § 1º CLT: ±10 min diários não geram crédito/débito
}

export interface BancoDeHorasBaselineConfig {
  /** Signed balance in minutes from the user's last manual HR measurement (e.g. +320 or -90) */
  initialMinutes: number;
  /** Inclusive YYYY-MM-DD cutoff date from which app punches add to initialMinutes. Empty = all days */
  startDateRaw: string;
}

export const DEFAULT_BANCO_BASELINE: BancoDeHorasBaselineConfig = {
  initialMinutes: 0,
  startDateRaw: '',
};

export const DEFAULT_WORK_SCHEDULE: WorkScheduleConfig = {
  workDays: [1, 2, 3, 4, 5], // Seg a Sex
  workStart: '08:00',
  workEnd: '17:48',
  lunchDurationMinutes: 60, // 1 hora de almoço padrão
  cltToleranceEnabled: false,
};

export const DEFAULT_LUNCH_MINUTES = 60; // 1 hora de almoço (configurável para 59 ou 60 min)

export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatShortTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Formats local calendar date as YYYY-MM-DD (avoids UTC shift after 21:00 BRT).
 */
export function formatLocalRawDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function formatDateBrazilian(date: Date): string {
  const day = date.getDate();
  const daysOfWeek = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const month = PT_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const weekDay = daysOfWeek[date.getDay()];

  return `${day} de ${month} de ${year} - ${weekDay}`;
}

/**
 * Parses Brazilian formatted date labels like "10 de novembro de 2026 - ter" into "2026-11-10".
 */
export function parseRawDateFromBrazilianLabel(label: string): string | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthIdx = PT_MONTHS.indexOf(match[2]);
  const year = parseInt(match[3], 10);
  if (monthIdx === -1 || Number.isNaN(day) || Number.isNaN(year)) return null;
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function calculateZeroSecondLunchTarget(
  punchEpochMs: number,
  durationMinutes: number
): {
  startMinuteEpoch: number;
  targetEpoch: number;
  expectedEndTimeStr: string;
} {
  const startDate = new Date(punchEpochMs);
  startDate.setSeconds(0, 0);
  const startMinuteEpoch = startDate.getTime();
  const targetEpoch = startMinuteEpoch + durationMinutes * 60 * 1000;
  return {
    startMinuteEpoch,
    targetEpoch,
    expectedEndTimeStr: formatTime(new Date(targetEpoch)),
  };
}

export function computeLunchEndTimeFromTimeStr(
  timeStr: string,
  durationMinutes: number
): string {
  const totalMinutes = (timeStringToMinutes(timeStr) + durationMinutes) % (24 * 60);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

export function calculateRemainingSeconds(
  startEpochMs: number,
  durationMinutes: number,
  currentEpochMs: number,
  targetEpochMs?: number
): number {
  const target =
    typeof targetEpochMs === 'number' && Number.isFinite(targetEpochMs)
      ? targetEpochMs
      : startEpochMs + durationMinutes * 60 * 1000;
  const remainingMs = target - currentEpochMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

export const PREVENTIVE_LUNCH_ALERT_SECONDS = 60;

/**
 * Returns true during the final minute (1..thresholdSeconds) before the target
 * zero-second lunch return time so the user is warned ahead of residual seconds.
 */
export function shouldShowPreventiveLunchAlert(
  remainingSeconds: number,
  thresholdSeconds: number = PREVENTIVE_LUNCH_ALERT_SECONDS
): boolean {
  return remainingSeconds > 0 && remainingSeconds <= thresholdSeconds;
}

export function formatCountdown(secondsLeft: number): string {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Bom Dia!';
  if (hour >= 12 && hour < 18) return 'Boa Tarde!';
  return 'Boa Noite!';
}

// Convert "HH:MM" or "HH:MM:SS" to total minutes
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

// Format total minutes to "+02h 15m" or "-01h 30m"
export function formatMinutesToHours(minutes: number, withSign = true): string {
  const isNegative = minutes < 0;
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;

  const paddedH = String(h).padStart(2, '0');
  const paddedM = String(m).padStart(2, '0');

  if (withSign) {
    if (minutes === 0) return `00h 00m`;
    const sign = isNegative ? '-' : '+';
    return `${sign}${paddedH}h ${paddedM}m`;
  }

  return `${paddedH}h ${paddedM}m`;
}

// Check if a given date is a configured work day
export function isDayAWorkDay(date: Date, workDays: number[]): boolean {
  return workDays.includes(date.getDay());
}

// Calculate scheduled/expected work minutes for a day
export function getExpectedDailyWorkMinutes(
  schedule: WorkScheduleConfig,
  date: Date
): number {
  // If not in work days (e.g. Saturday or Sunday), expected work hours is 0! Everything is extra bank of hours.
  if (!isDayAWorkDay(date, schedule.workDays)) {
    return 0;
  }

  const startMins = timeStringToMinutes(schedule.workStart);
  const endMins = timeStringToMinutes(schedule.workEnd);
  const grossMinutes = Math.max(0, endMins - startMins);
  const netMinutes = Math.max(0, grossMinutes - schedule.lunchDurationMinutes);
  return netMinutes;
}

// Calculate total minutes worked from a list of punch records for a day
export function calculatePunchesWorkedMinutes(
  punches: PunchRecord[],
  currentDateNow?: Date
): {
  workedMinutes: number;
  inProgress: boolean;
} {
  if (!punches || punches.length === 0) {
    return { workedMinutes: 0, inProgress: false };
  }

  // Sort punches chronologically by time
  const sorted = [...punches].sort((a, b) => {
    return timeStringToMinutes(a.shortTime || a.time) - timeStringToMinutes(b.shortTime || b.time);
  });

  let totalMinutes = 0;
  let inProgress = false;

  // Pair up punches: [0, 1] [2, 3] etc.
  for (let i = 0; i < sorted.length; i += 2) {
    const entry = sorted[i];
    const exit = sorted[i + 1];

    const entryMinutes = timeStringToMinutes(entry.shortTime || entry.time);

    if (exit) {
      const exitMinutes = timeStringToMinutes(exit.shortTime || exit.time);
      if (exitMinutes >= entryMinutes) {
        totalMinutes += exitMinutes - entryMinutes;
      }
    } else {
      // Incomplete pair: user is currently clocked in!
      inProgress = true;
      if (currentDateNow) {
        const nowMinutes = currentDateNow.getHours() * 60 + currentDateNow.getMinutes();
        if (nowMinutes > entryMinutes) {
          totalMinutes += nowMinutes - entryMinutes;
        }
      }
    }
  }

  return { workedMinutes: Math.max(0, totalMinutes), inProgress };
}

// Full calculation of daily balance
export function calculateDailyBalance(
  punches: PunchRecord[],
  schedule: WorkScheduleConfig,
  date: Date,
  currentDateNow?: Date
): {
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  rawBalanceMinutes: number;
  withinCltTolerance: boolean;
  isExtraDay: boolean; // True if worked on weekend or day off (100% bank of hours)
  inProgress: boolean;
} {
  const isWorkDay = isDayAWorkDay(date, schedule.workDays);
  const expectedMinutes = getExpectedDailyWorkMinutes(schedule, date);
  const { workedMinutes, inProgress } = calculatePunchesWorkedMinutes(punches, currentDateNow);

  // If it's a day off (e.g. Saturday), all worked minutes are pure extra bank of hours!
  const rawBalanceMinutes = isWorkDay
    ? workedMinutes - expectedMinutes
    : workedMinutes;

  // CLT Art. 58 § 1º: ±10 min daily tolerance when day is completed (even punch count >= 2)
  const withinCltTolerance = Boolean(
    schedule.cltToleranceEnabled &&
      isWorkDay &&
      !inProgress &&
      punches.length >= 2 &&
      rawBalanceMinutes !== 0 &&
      Math.abs(rawBalanceMinutes) <= 10
  );

  const balanceMinutes = withinCltTolerance ? 0 : rawBalanceMinutes;

  return {
    workedMinutes,
    expectedMinutes,
    balanceMinutes,
    rawBalanceMinutes,
    withinCltTolerance,
    isExtraDay: !isWorkDay,
    inProgress,
  };
}

export interface ParsedPortalPunch {
  time: string; // "07:39:00"
  shortTime: string; // "07:39"
  isLunch: boolean;
  type: 'entrada' | 'almoco_ida' | 'almoco_volta' | 'saida';
  status: 'confirmado';
}

/**
 * Extracts punches listed under "Marcações do dia" from the official portal's page snapshot/HTML text.
 * Matches times like 07:39, 11:38 and tags lunch or entrance appropriately.
 */
export function parsePortalPunchesFromSnapshot(snapshotText: string): ParsedPortalPunch[] {
  if (!snapshotText) return [];

  // Locate the "Marcações do dia" section if present
  let relevantText = snapshotText;
  const marcaIndex = snapshotText.search(/marcaç(õ|o)es do dia/i);
  if (marcaIndex !== -1) {
    // Window of content within "Marcações do dia"
    relevantText = snapshotText.slice(marcaIndex, marcaIndex + 1500);
    const nextSectionIndex = relevantText.search(/(banco de horas|solicitaç|holerite|férias|configuraç)/i);
    if (nextSectionIndex > 100) {
      relevantText = relevantText.slice(0, nextSectionIndex);
    }
  }

  // Regex to match times like "07:39" or "11:38:00"
  const timeRegex = /\b([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/g;
  const matches = relevantText.match(timeRegex);

  if (!matches || matches.length === 0) {
    return [];
  }

  // Deduplicate preserving chronological order
  const uniqueTimes: string[] = [];
  for (const rawTime of matches) {
    const short = rawTime.slice(0, 5);
    if (!uniqueTimes.includes(short)) {
      uniqueTimes.push(short);
    }
  }

  return uniqueTimes.map((shortTime, idx) => {
    const timeIndex = relevantText.indexOf(shortTime);
    const nearby = timeIndex !== -1 ? relevantText.slice(Math.max(0, timeIndex - 40), timeIndex + 60).toLowerCase() : '';
    const hasLunchKeyword = nearby.includes('almoço') || nearby.includes('almoco');

    let type: 'entrada' | 'almoco_ida' | 'almoco_volta' | 'saida' = 'entrada';
    let isLunch = false;

    if (idx === 0) {
      type = 'entrada';
      isLunch = false;
    } else if (idx === 1) {
      type = 'almoco_ida';
      isLunch = true;
    } else if (idx === 2) {
      type = 'almoco_volta';
      isLunch = true;
    } else {
      type = 'saida';
      isLunch = false;
    }

    if (hasLunchKeyword) {
      isLunch = true;
    }

    return {
      time: `${shortTime}:00`,
      shortTime,
      isLunch,
      type,
      status: 'confirmado' as const,
    };
  });
}

export type PortalFlowMode = 'auto_punch' | 'manual_punch' | 'verify_punches' | 'test_connection';

/**
 * Normalizes punch items coming from Norber's API (ISO strings like "2026-11-13T07:38:00"
 * or "HH:mm" strings) or DOM timeline text into chronological ParsedPortalPunch records.
 */
export function normalizePortalMarcacoes(rawItems: unknown[]): ParsedPortalPunch[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];

  const extractedShorts: string[] = [];

  for (const item of rawItems) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    // Match ISO timestamp time part: "2026-11-13T07:38:15" or "2026-11-13T07:38:15-03:00"
    const isoMatch = trimmed.match(/T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?/);
    if (isoMatch) {
      extractedShorts.push(`${isoMatch[1]}:${isoMatch[2]}`);
      continue;
    }

    // Match standalone HH:mm or HH:mm:ss
    const hhmmMatch = trimmed.match(/\b([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/);
    if (hhmmMatch) {
      extractedShorts.push(`${hhmmMatch[1]}:${hhmmMatch[2]}`);
    }
  }

  // Deduplicate and sort chronologically
  const uniqueSorted = Array.from(new Set(extractedShorts)).sort(
    (a, b) => timeStringToMinutes(a) - timeStringToMinutes(b)
  );

  return uniqueSorted.map((shortTime, idx) => {
    let type: 'entrada' | 'almoco_ida' | 'almoco_volta' | 'saida' = 'entrada';
    let isLunch = false;

    if (idx === 0) {
      type = 'entrada';
    } else if (idx === 1) {
      type = 'almoco_ida';
      isLunch = true;
    } else if (idx === 2) {
      type = 'almoco_volta';
      isLunch = true;
    } else {
      type = 'saida';
    }

    return {
      time: `${shortTime}:00`,
      shortTime,
      isLunch,
      type,
      status: 'confirmado' as const,
    };
  });
}

export interface JourneyPrediction {
  workedMinutes: number;
  expectedMinutes: number;
  remainingMinutes: number;
  progressPercent: number;
  nextPunchLabel: string;
  predictedExitTimeStr: string | null;
  isExtraDay: boolean;
  inProgress: boolean;
}

/**
 * Computes today's live shift progress percentage, next expected punch type,
 * and predicted final exit time (HH:MM) based on recorded punches and schedule.
 */
export function calculateJourneyPrediction(
  punches: PunchRecord[],
  schedule: WorkScheduleConfig,
  date: Date,
  currentDateNow?: Date
): JourneyPrediction {
  const daily = calculateDailyBalance(punches, schedule, date, currentDateNow);
  const sorted = [...(punches || [])].sort(
    (a, b) => timeStringToMinutes(a.shortTime || a.time) - timeStringToMinutes(b.shortTime || b.time)
  );

  const count = sorted.length;
  let nextPunchLabel = 'Entrada';
  if (count === 1) nextPunchLabel = 'Saída Almoço';
  else if (count === 2) nextPunchLabel = 'Volta Almoço';
  else if (count === 3) nextPunchLabel = 'Saída Final';
  else if (count >= 4) nextPunchLabel = count % 2 === 0 ? 'Hora Extra (Entrada)' : 'Hora Extra (Saída)';

  const remainingMinutes = Math.max(0, daily.expectedMinutes - daily.workedMinutes);
  const progressPercent =
    daily.expectedMinutes > 0
      ? Math.min(100, Math.round((daily.workedMinutes / daily.expectedMinutes) * 100))
      : daily.workedMinutes > 0
        ? 100
        : 0;

  let predictedExitTimeStr: string | null = null;
  if (!daily.isExtraDay && daily.expectedMinutes > 0 && count > 0 && count < 4) {
    if (daily.inProgress && currentDateNow) {
      const nowMins = currentDateNow.getHours() * 60 + currentDateNow.getMinutes();
      const lunchAllowance = count === 1 ? schedule.lunchDurationMinutes : 0;
      const exitMins = (nowMins + remainingMinutes + lunchAllowance) % (24 * 60);
      const eh = String(Math.floor(exitMins / 60)).padStart(2, '0');
      const em = String(exitMins % 60).padStart(2, '0');
      predictedExitTimeStr = `${eh}:${em}`;
    } else if (count === 2) {
      // Returned at punch[1] + lunchDuration, remaining work after lunch
      const lunchOutMins = timeStringToMinutes(sorted[1].shortTime || sorted[1].time);
      const expectedLunchReturn = lunchOutMins + schedule.lunchDurationMinutes;
      const exitMins = (expectedLunchReturn + remainingMinutes) % (24 * 60);
      const eh = String(Math.floor(exitMins / 60)).padStart(2, '0');
      const em = String(exitMins % 60).padStart(2, '0');
      predictedExitTimeStr = `${eh}:${em}`;
    }
  }

  return {
    workedMinutes: daily.workedMinutes,
    expectedMinutes: daily.expectedMinutes,
    remainingMinutes,
    progressPercent,
    nextPunchLabel,
    predictedExitTimeStr,
    isExtraDay: daily.isExtraDay,
    inProgress: daily.inProgress,
  };
}

export interface CustomAccentTokens {
  hex: string;
  rgb: string;
  accent: string;
  accentHover: string;
  accentFg: string;
  accentText: string;
  accentSoft: string;
  accentBorder: string;
  accentGlow: string;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function normalizeHex(hex: string): string {
  const clean = (hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return (
      '#' +
      clean
        .split('')
        .map((c) => c + c)
        .join('')
        .toLowerCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '#' + clean.toLowerCase();
  }
  return '#eab308';
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const norm = normalizeHex(hex).slice(1);
  return [
    parseInt(norm.slice(0, 2), 16),
    parseInt(norm.slice(2, 4), 16),
    parseInt(norm.slice(4, 6), 16),
  ];
}

function rgbTupleToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * Generates accessible Light & Dark CSS custom property tokens from any hex color.
 */
export function computeCustomAccentTokens(hex: string, isDark: boolean): CustomAccentTokens {
  const normalized = normalizeHex(hex);
  const [r, g, b] = hexToRgbTuple(normalized);
  const lum = relativeLuminance(r, g, b);

  // Foreground inside solid accent buttons: dark ink on bright fills, white ink on deep fills
  const accentFg = lum > 0.44 ? '#09090b' : '#ffffff';

  // Ensure text on card background stays legible in both themes
  let textRgb: [number, number, number] = [r, g, b];
  if (isDark && lum < 0.22) {
    // Lift dark accent colors on dark surfaces
    textRgb = [clampByte(r + (255 - r) * 0.38), clampByte(g + (255 - g) * 0.38), clampByte(b + (255 - b) * 0.38)];
  } else if (!isDark && lum > 0.42) {
    // Deepen bright accent colors (like yellow/cyan) on light surfaces
    textRgb = [clampByte(r * 0.62), clampByte(g * 0.62), clampByte(b * 0.62)];
  }

  const hoverRgb: [number, number, number] = isDark
    ? [clampByte(r + (255 - r) * 0.2), clampByte(g + (255 - g) * 0.2), clampByte(b + (255 - b) * 0.2)]
    : [clampByte(r * 0.84), clampByte(g * 0.84), clampByte(b * 0.84)];

  return {
    hex: normalized,
    rgb: `${r}, ${g}, ${b}`,
    accent: normalized,
    accentHover: rgbTupleToHex(...hoverRgb),
    accentFg,
    accentText: rgbTupleToHex(...textRgb),
    accentSoft: `rgba(${r}, ${g}, ${b}, ${isDark ? 0.14 : 0.12})`,
    accentBorder: `rgba(${r}, ${g}, ${b}, 0.36)`,
    accentGlow: `rgba(${r}, ${g}, ${b}, 0.28)`,
  };
}

/**
 * Masks CPF or username cleanly for Privacy Mode display in public places.
 */
export function maskCredentialDisplay(value: string, hidden: boolean): string {
  const clean = (value || '').trim();
  if (!clean) return 'Não configurado';
  if (!hidden) return clean;
  if (clean.length <= 4) return '••••';
  const middle = clean.slice(3, 6);
  return `•••.${middle}.•••-••`;
}

export interface IncompleteWorkDay {
  dateLabel: string;
  rawDate?: string;
  punchCount: number;
  times: string[];
}

/**
 * Identifies past days (excluding today) that ended with an odd number of punches,
 * helping prevent missed-punch issues in HR payroll closing.
 */
export function findIncompleteWorkDays(
  punches: PunchRecord[],
  todayRawDate: string
): IncompleteWorkDay[] {
  if (!Array.isArray(punches) || punches.length === 0) return [];

  const byDate = new Map<string, { dateLabel: string; rawDate?: string; punches: PunchRecord[] }>();
  for (const p of punches) {
    if (p.id === 'mock-1' || p.id === 'mock-2') continue;
    if (p.rawDate && p.rawDate === todayRawDate) continue;
    const key = p.rawDate || p.dateStr;
    if (!key) continue;
    if (!byDate.has(key)) {
      byDate.set(key, { dateLabel: p.dateStr || key, rawDate: p.rawDate, punches: [] });
    }
    byDate.get(key)!.punches.push(p);
  }

  const incomplete: IncompleteWorkDay[] = [];
  for (const group of byDate.values()) {
    if (group.punches.length % 2 !== 0) {
      const sorted = [...group.punches].sort(
        (a, b) => timeStringToMinutes(a.shortTime || a.time) - timeStringToMinutes(b.shortTime || b.time)
      );
      incomplete.push({
        dateLabel: group.dateLabel,
        rawDate: group.rawDate,
        punchCount: sorted.length,
        times: sorted.map((p) => p.shortTime || p.time.slice(0, 5)),
      });
    }
  }

  return incomplete;
}

export interface MobileWidgetPayload {
  dateStr: string;
  updatedAt: string;
  workedText: string;
  expectedText: string;
  progressPercent: number;
  nextPunchLabel: string;
  predictedExitTimeStr: string;
  punchCount: number;
  punchListText: string;
  slots: Array<{ label: string; time: string; filled: boolean }>;
  notificationTitle: string;
  notificationBody: string;
}

/**
 * Builds structured daily punch data used by:
 * 1. Sticky Android notification-bar / lockscreen widget
 * 2. Edge PWA Adaptive Card Widget (`/widgets/today-punches-data.json`)
 * 3. Floating Desktop/Mobile Mini-Widget & Previewer
 */
export function buildWidgetPayload(
  todayPunches: PunchRecord[],
  schedule: WorkScheduleConfig,
  now: Date,
  privacyMode = false
): MobileWidgetPayload {
  const sorted = [...(todayPunches || [])].sort(
    (a, b) => timeStringToMinutes(a.shortTime || a.time) - timeStringToMinutes(b.shortTime || b.time)
  );
  const prediction = calculateJourneyPrediction(sorted, schedule, now, now);
  const workedText = formatMinutesToHours(prediction.workedMinutes, false);
  const expectedText = prediction.isExtraDay
    ? 'Folga 100%'
    : formatMinutesToHours(prediction.expectedMinutes, false);

  const slotLabels = ['Entrada', 'Ida Almoço', 'Volta Almoço', 'Saída'];
  const slots = slotLabels.map((label, idx) => {
    const rec = sorted[idx];
    return {
      label,
      time: rec ? (privacyMode ? '••:••' : rec.shortTime || rec.time.slice(0, 5)) : '--:--',
      filled: Boolean(rec),
    };
  });

  const timesDisplay =
    sorted.length > 0
      ? sorted.map((p) => (privacyMode ? '••:••' : p.shortTime || p.time.slice(0, 5))).join(' · ')
      : 'Nenhuma batida hoje';

  const punchListText =
    sorted.length > 0
      ? sorted.map((p, i) => `${slotLabels[i] || `#${i + 1}`}: ${privacyMode ? '••:••' : p.shortTime || p.time.slice(0, 5)}`).join(' | ')
      : 'Sem marcações registradas hoje ainda';

  const exitPart = prediction.predictedExitTimeStr
    ? `Saída est. ${privacyMode ? '••:••' : prediction.predictedExitTimeStr}`
    : prediction.isExtraDay
      ? 'Dia Extra'
      : `Meta ${expectedText}`;

  const notificationTitle =
    sorted.length > 0
      ? `📋 Hoje (${sorted.length}): ${timesDisplay}`
      : '📋 PontoFácil • Nenhuma batida hoje';

  const notificationBody = `Trab: ${workedText} (${prediction.progressPercent}%) • Próx: ${prediction.nextPunchLabel} • ${exitPart}`;

  return {
    dateStr: formatDateBrazilian(now),
    updatedAt: formatShortTime(now),
    workedText,
    expectedText,
    progressPercent: prediction.progressPercent,
    nextPunchLabel: prediction.nextPunchLabel,
    predictedExitTimeStr: prediction.predictedExitTimeStr || '--:--',
    punchCount: sorted.length,
    punchListText,
    slots,
    notificationTitle,
    notificationBody,
  };
}

/**
 * Resolves a canonical YYYY-MM-DD raw date from punches or a Brazilian date label.
 */
export function resolvePunchRawDate(dayPunches: PunchRecord[], dateLabel: string): string | null {
  const fromField = dayPunches.find((p) => p.rawDate && /^\d{4}-\d{2}-\d{2}$/.test(p.rawDate))?.rawDate;
  if (fromField) return fromField;

  const fromLabel = parseRawDateFromBrazilianLabel(dateLabel);
  if (fromLabel) return fromLabel;

  for (const p of dayPunches) {
    const match = p.id.match(/^(?:punch|manual)-(\d{10,})$/);
    if (match) {
      return formatLocalRawDate(new Date(Number(match[1])));
    }
  }

  return null;
}

export interface CombinedBankDailyInput {
  rawDate: string | null;
  balanceMinutes: number;
}

export interface CombinedBankResult {
  initialMinutes: number;
  startDateRaw: string;
  appAccumulatedMinutes: number;
  ignoredBeforeCutoffMinutes: number;
  totalCombinedMinutes: number;
  includedDaysCount: number;
  ignoredDaysCount: number;
}

/**
 * Combines the user's manually entered HR Banco de Horas baseline (`initialMinutes`)
 * with app-recorded daily balances starting from `startDateRaw` (inclusive).
 * Days strictly before `startDateRaw` are excluded from the sum so prior history
 * never double-counts hours already reflected in the manual baseline.
 */
export function calculateCombinedBankOfHours(
  dailyEntries: CombinedBankDailyInput[],
  baseline: BancoDeHorasBaselineConfig
): CombinedBankResult {
  const cutoff = (baseline.startDateRaw || '').trim();
  const initial = Number.isFinite(baseline.initialMinutes) ? Math.trunc(baseline.initialMinutes) : 0;

  let appAccumulatedMinutes = 0;
  let ignoredBeforeCutoffMinutes = 0;
  let includedDaysCount = 0;
  let ignoredDaysCount = 0;

  for (const entry of dailyEntries) {
    const isIncluded = !cutoff || (entry.rawDate !== null && entry.rawDate >= cutoff);
    if (isIncluded) {
      appAccumulatedMinutes += entry.balanceMinutes;
      includedDaysCount += 1;
    } else {
      ignoredBeforeCutoffMinutes += entry.balanceMinutes;
      ignoredDaysCount += 1;
    }
  }

  return {
    initialMinutes: initial,
    startDateRaw: cutoff,
    appAccumulatedMinutes,
    ignoredBeforeCutoffMinutes,
    totalCombinedMinutes: initial + appAccumulatedMinutes,
    includedDaysCount,
    ignoredDaysCount,
  };
}

export type BackupImportMode = 'merge' | 'replace';

export interface BackupAppSettings {
  lunchDurationMinutes?: number;
  useSimulation?: boolean;
  humanMode?: boolean;
  autoVisibility?: AutoVisibility;
  alarmSoundId?: AlarmSoundId;
  privacyMode?: boolean;
  widgetPinned?: boolean;
}

export interface BackupPayloadV2 {
  version: 2;
  exportedAt: string;
  app: 'PontoFacil-Pernambucanas';
  punches: PunchRecord[];
  workSchedule: WorkScheduleConfig;
  bancoBaseline: BancoDeHorasBaselineConfig;
  visual: Partial<VisualThemeConfig>;
  settings: BackupAppSettings;
}

export function buildExportBackupPayload(params: {
  punches: PunchRecord[];
  workSchedule: WorkScheduleConfig;
  bancoBaseline: BancoDeHorasBaselineConfig;
  visual: VisualThemeConfig;
  settings: BackupAppSettings;
  now?: Date;
}): BackupPayloadV2 {
  return {
    version: 2,
    exportedAt: (params.now || new Date()).toISOString(),
    app: 'PontoFacil-Pernambucanas',
    punches: params.punches,
    workSchedule: params.workSchedule,
    bancoBaseline: params.bancoBaseline,
    visual: params.visual,
    settings: params.settings,
  };
}

export interface ParsedBackupImportResult {
  valid: boolean;
  error?: string;
  punches: PunchRecord[];
  addedCount: number;
  skippedDuplicates: number;
  workSchedule?: WorkScheduleConfig;
  bancoBaseline?: BancoDeHorasBaselineConfig;
  visual?: Partial<VisualThemeConfig>;
  settings?: BackupAppSettings;
}

function sanitizeImportedPunch(raw: unknown, idx: number): PunchRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const timeStr = typeof obj.time === 'string' ? obj.time : typeof obj.shortTime === 'string' ? `${obj.shortTime}:00` : '';
  const shortTime = typeof obj.shortTime === 'string' ? obj.shortTime.slice(0, 5) : timeStr.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(shortTime)) return null;

  const validType =
    obj.type === 'entrada' ||
    obj.type === 'almoco_ida' ||
    obj.type === 'almoco_volta' ||
    obj.type === 'saida' ||
    obj.type === 'avulso'
      ? obj.type
      : 'avulso';
  const validStatus =
    obj.status === 'confirmado' || obj.status === 'simulado' || obj.status === 'falha'
      ? obj.status
      : 'confirmado';

  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id : `imported-${Date.now()}-${idx}`,
    time: timeStr || `${shortTime}:00`,
    shortTime,
    dateStr: typeof obj.dateStr === 'string' ? obj.dateStr : '',
    rawDate: typeof obj.rawDate === 'string' ? obj.rawDate : undefined,
    isLunch: Boolean(obj.isLunch),
    type: validType,
    status: validStatus,
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

/**
 * Parses and validates v1/v2 `.json` backup exports from another device,
 * supporting either deduplicated merging or clean replacement.
 */
export function parseAndMergeBackupPayload(
  rawJsonText: string,
  existingPunches: PunchRecord[],
  mode: BackupImportMode = 'merge'
): ParsedBackupImportResult {
  let parsed: Record<string, unknown>;
  try {
    const data = JSON.parse(rawJsonText);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {
        valid: false,
        error: 'Arquivo JSON inválido: estrutura principal não reconhecida.',
        punches: existingPunches,
        addedCount: 0,
        skippedDuplicates: 0,
      };
    }
    parsed = data as Record<string, unknown>;
  } catch {
    return {
      valid: false,
      error: 'Não foi possível ler o arquivo .json selecionado.',
      punches: existingPunches,
      addedCount: 0,
      skippedDuplicates: 0,
    };
  }

  const rawPunches = Array.isArray(parsed.punches) ? parsed.punches : [];
  const sanitized = rawPunches
    .map((item, idx) => sanitizeImportedPunch(item, idx))
    .filter((item): item is PunchRecord => item !== null);

  const hasSettingsPayload = Boolean(
    parsed.workSchedule || parsed.bancoBaseline || parsed.config || parsed.visual || parsed.settings
  );

  if (rawPunches.length === 0 && !hasSettingsPayload) {
    return {
      valid: false,
      error: 'O arquivo .json não contém marcações nem configurações do PontoFácil.',
      punches: existingPunches,
      addedCount: 0,
      skippedDuplicates: 0,
    };
  }

  let nextPunches: PunchRecord[] = [];
  let addedCount = 0;
  let skippedDuplicates = 0;

  if (mode === 'replace') {
    nextPunches = sanitized;
    addedCount = sanitized.length;
  } else {
    const existingKeys = new Set(
      existingPunches.map((p) => {
        const dateKey = p.rawDate || parseRawDateFromBrazilianLabel(p.dateStr) || p.dateStr || '';
        return `${dateKey}|${p.shortTime || p.time.slice(0, 5)}|${p.status}`;
      })
    );
    const toAdd: PunchRecord[] = [];
    for (const item of sanitized) {
      const dateKey = item.rawDate || parseRawDateFromBrazilianLabel(item.dateStr) || item.dateStr || '';
      const key = `${dateKey}|${item.shortTime}|${item.status}`;
      if (existingKeys.has(key)) {
        skippedDuplicates += 1;
      } else {
        existingKeys.add(key);
        toAdd.push(item);
        addedCount += 1;
      }
    }
    nextPunches = [...toAdd, ...existingPunches];
  }

  // Merge legacy `config` (v1) + structured `visual` / `settings` (v2)
  const legacyCfg =
    parsed.config && typeof parsed.config === 'object'
      ? (parsed.config as Record<string, unknown>)
      : {};
  const v2Visual =
    parsed.visual && typeof parsed.visual === 'object'
      ? (parsed.visual as Partial<VisualThemeConfig>)
      : {};
  const v2Settings =
    parsed.settings && typeof parsed.settings === 'object'
      ? (parsed.settings as BackupAppSettings)
      : {};

  const mergedVisual: Partial<VisualThemeConfig> = {
    ...(legacyCfg as Partial<VisualThemeConfig>),
    ...v2Visual,
  };
  const mergedSettings: BackupAppSettings = {
    lunchDurationMinutes:
      v2Settings.lunchDurationMinutes ??
      (typeof legacyCfg.lunchDurationMinutes === 'number' ? legacyCfg.lunchDurationMinutes : undefined),
    useSimulation:
      v2Settings.useSimulation ??
      (typeof legacyCfg.useSimulation === 'boolean' ? legacyCfg.useSimulation : undefined),
    humanMode:
      v2Settings.humanMode ??
      (typeof legacyCfg.humanMode === 'boolean' ? legacyCfg.humanMode : undefined),
    autoVisibility:
      v2Settings.autoVisibility ??
      (legacyCfg.autoVisibility === 'background' || legacyCfg.autoVisibility === 'visible'
        ? legacyCfg.autoVisibility
        : undefined),
    alarmSoundId: v2Settings.alarmSoundId ?? (legacyCfg.alarmSoundId as AlarmSoundId | undefined),
    privacyMode:
      v2Settings.privacyMode ??
      (typeof legacyCfg.privacyMode === 'boolean' ? legacyCfg.privacyMode : undefined),
    widgetPinned:
      v2Settings.widgetPinned ??
      (typeof legacyCfg.widgetPinned === 'boolean' ? legacyCfg.widgetPinned : undefined),
  };

  return {
    valid: true,
    punches: nextPunches,
    addedCount,
    skippedDuplicates,
    workSchedule:
      parsed.workSchedule && typeof parsed.workSchedule === 'object'
        ? (parsed.workSchedule as WorkScheduleConfig)
        : undefined,
    bancoBaseline:
      parsed.bancoBaseline && typeof parsed.bancoBaseline === 'object'
        ? (parsed.bancoBaseline as BancoDeHorasBaselineConfig)
        : undefined,
    visual: Object.keys(mergedVisual).length > 0 ? mergedVisual : undefined,
    settings: Object.values(mergedSettings).some((v) => v !== undefined) ? mergedSettings : undefined,
  };
}



