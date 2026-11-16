import {
  PunchRecord,
  WorkScheduleConfig,
  DEFAULT_WORK_SCHEDULE,
  calculateDailyBalance,
  formatDateBrazilian,
  formatMinutesToHours,
  timeStringToMinutes,
} from './punch-rules';

export const DATABASE_SPREADSHEET_TITLE = 'PontoFácil Pernambucanas - Banco de Dados';

export const SHEET_TABS = {
  USUARIOS: 'Usuarios',
  BATIDAS: 'Batidas',
  BANCO: 'BancoDeHoras',
} as const;

export const USUARIOS_HEADER = [
  'Usuario',
  'NomeExibicao',
  'EscalaDias',
  'HoraEntrada',
  'HoraSaida',
  'AlmocoMinutos',
  'TotalBatidas',
  'SaldoTotalMin',
  'SaldoTotalFormatado',
  'CriadoEm',
  'AtualizadoEm',
];

export const BATIDAS_HEADER = [
  'ID',
  'Usuario',
  'DataBR',
  'DataISO',
  'Horario',
  'HorarioCurto',
  'Tipo',
  'Status',
  'Almoco',
  'Observacao',
  'AtualizadoEm',
];

export const BANCO_HEADER = [
  'Usuario',
  'DataBR',
  'DataISO',
  'Batidas',
  'Trabalhado',
  'Meta',
  'SaldoDia',
  'FolgaExtra',
  'StatusDia',
  'AtualizadoEm',
];

export interface CloudUserProfile {
  usuario: string;
  nomeExibicao: string;
  schedule: WorkScheduleConfig;
  totalBatidas: number;
  saldoTotalMin: number;
  saldoTotalFormatado: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Normalizes a Pernambucanas login/CPF so "506.275.268-02" and "50627526802"
 * map deterministically to the same user key across different devices.
 */
export function normalizeUserKey(rawUsuario: string): string {
  const trimmed = (rawUsuario || '').trim();
  if (!trimmed) return '';

  // If input looks like a numeric login / CPF (digits with optional punctuation)
  if (/^[\d.\-\/\s]+$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length > 0) return digits;
  }

  return trimmed.toLowerCase();
}

export function isDemoMockPunch(punch: Pick<PunchRecord, 'id'>): boolean {
  return punch.id === 'mock-1' || punch.id === 'mock-2';
}

export function extractSpreadsheetIdFromInput(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function parseUsersSheetRows(rows: string[][]): CloudUserProfile[] {
  if (!Array.isArray(rows) || rows.length <= 1) return [];

  const result: CloudUserProfile[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const userKey = normalizeUserKey(row[0]);
    if (!userKey) continue;

    const workDaysRaw = (row[2] || '').trim();
    const parsedDays = workDaysRaw
      ? workDaysRaw
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6)
      : [...DEFAULT_WORK_SCHEDULE.workDays];

    const schedule: WorkScheduleConfig = {
      workDays: parsedDays.length > 0 ? parsedDays : [...DEFAULT_WORK_SCHEDULE.workDays],
      workStart: row[3]?.trim() || DEFAULT_WORK_SCHEDULE.workStart,
      workEnd: row[4]?.trim() || DEFAULT_WORK_SCHEDULE.workEnd,
      lunchDurationMinutes: parseInt(row[5] || '', 10) || DEFAULT_WORK_SCHEDULE.lunchDurationMinutes,
    };

    const saldoMin = parseInt(row[7] || '0', 10) || 0;

    result.push({
      usuario: userKey,
      nomeExibicao: row[1]?.trim() || userKey,
      schedule,
      totalBatidas: parseInt(row[6] || '0', 10) || 0,
      saldoTotalMin: saldoMin,
      saldoTotalFormatado: row[8]?.trim() || formatMinutesToHours(saldoMin),
      criadoEm: row[9]?.trim() || '',
      atualizadoEm: row[10]?.trim() || '',
    });
  }

  return result;
}

export function serializeUserProfileRow(profile: CloudUserProfile): string[] {
  return [
    normalizeUserKey(profile.usuario),
    profile.nomeExibicao || normalizeUserKey(profile.usuario),
    profile.schedule.workDays.join(','),
    profile.schedule.workStart,
    profile.schedule.workEnd,
    String(profile.schedule.lunchDurationMinutes),
    String(profile.totalBatidas),
    String(profile.saldoTotalMin),
    profile.saldoTotalFormatado,
    profile.criadoEm,
    profile.atualizadoEm,
  ];
}

export function parsePunchSheetRows(rows: string[][], targetUserKey: string): PunchRecord[] {
  const normalizedTarget = normalizeUserKey(targetUserKey);
  if (!normalizedTarget || !Array.isArray(rows) || rows.length <= 1) return [];

  const punches: PunchRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !row[1]) continue;

    const rowUser = normalizeUserKey(row[1]);
    if (rowUser !== normalizedTarget) continue;

    const rawTime = (row[4] || '').trim();
    const shortTime = (row[5] || rawTime.slice(0, 5) || '').trim();
    const time = rawTime || (shortTime ? `${shortTime}:00` : '00:00:00');
    const rawDate = (row[3] || '').trim();
    const dateStr = (row[2] || '').trim() || (rawDate ? formatDateBrazilian(parseLocalDate(rawDate)) : '');

    const rawType = (row[6] || 'entrada').trim() as PunchRecord['type'];
    const validTypes: PunchRecord['type'][] = ['entrada', 'almoco_ida', 'almoco_volta', 'saida', 'avulso'];
    const type = validTypes.includes(rawType) ? rawType : 'avulso';

    const rawStatus = (row[7] || 'confirmado').trim() as PunchRecord['status'];
    const status: PunchRecord['status'] =
      rawStatus === 'simulado' || rawStatus === 'falha' ? rawStatus : 'confirmado';

    const isLunch = (row[8] || '').trim().toLowerCase() === 'sim' || type === 'almoco_ida' || type === 'almoco_volta';

    punches.push({
      id: row[0].trim(),
      dateStr,
      rawDate: rawDate || undefined,
      time,
      shortTime: shortTime || time.slice(0, 5),
      type,
      status,
      isLunch,
      note: row[9]?.trim() || undefined,
    });
  }

  return sortPunchesNewestFirst(punches);
}

function parseLocalDate(rawDate: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date();
}

function resolveRawDate(punch: PunchRecord): string {
  if (punch.rawDate && /^\d{4}-\d{2}-\d{2}$/.test(punch.rawDate)) {
    return punch.rawDate;
  }
  const match = punch.id.match(/^punch-(\d+)$/) || punch.id.match(/^manual-(\d+)$/);
  if (match) {
    return new Date(Number(match[1])).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export function sortPunchesNewestFirst(punches: PunchRecord[]): PunchRecord[] {
  return [...punches].sort((a, b) => {
    const dateA = resolveRawDate(a);
    const dateB = resolveRawDate(b);
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return timeStringToMinutes(b.shortTime || b.time) - timeStringToMinutes(a.shortTime || a.time);
  });
}

/**
 * Merges cloud punches with local real punches for a user, deduplicating by ID or
 * same (rawDate + shortTime + status) so multi-device syncing never duplicates punches.
 */
export function mergeUserPunches(localPunches: PunchRecord[], cloudPunches: PunchRecord[]): PunchRecord[] {
  const realLocal = (localPunches || []).filter((p) => !isDemoMockPunch(p));
  const realCloud = (cloudPunches || []).filter((p) => !isDemoMockPunch(p));

  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const merged: PunchRecord[] = [];

  const pushIfUnique = (punch: PunchRecord) => {
    const rawDate = resolveRawDate(punch);
    const shortTime = punch.shortTime || punch.time.slice(0, 5);
    const semanticKey = `${rawDate}|${shortTime}|${punch.status}`;

    if (seenIds.has(punch.id) || seenKeys.has(semanticKey)) return;
    seenIds.add(punch.id);
    seenKeys.add(semanticKey);
    merged.push({ ...punch, rawDate });
  };

  // Cloud records take precedence on tie, then local unsynced records
  for (const p of realCloud) pushIfUnique(p);
  for (const p of realLocal) pushIfUnique(p);

  return sortPunchesNewestFirst(merged);
}

export function serializePunchRow(userKey: string, punch: PunchRecord, nowIso: string): string[] {
  const normalizedUser = normalizeUserKey(userKey);
  const rawDate = resolveRawDate(punch);
  const dateStr = punch.dateStr || formatDateBrazilian(parseLocalDate(rawDate));
  const shortTime = punch.shortTime || punch.time.slice(0, 5);

  return [
    punch.id,
    normalizedUser,
    dateStr,
    rawDate,
    punch.time,
    shortTime,
    punch.type,
    punch.status,
    punch.isLunch ? 'Sim' : 'Não',
    punch.note || '',
    nowIso,
  ];
}

export function buildUserBancoDeHorasRows(
  userKey: string,
  punches: PunchRecord[],
  schedule: WorkScheduleConfig,
  nowDate = new Date(),
  nowIso = nowDate.toISOString()
): { totalBalanceMinutes: number; rows: string[][] } {
  const normalizedUser = normalizeUserKey(userKey);
  const realPunches = punches.filter((p) => !isDemoMockPunch(p));
  const todayRaw = nowDate.toISOString().slice(0, 10);

  const grouped = new Map<string, PunchRecord[]>();
  for (const p of realPunches) {
    const rawDate = resolveRawDate(p);
    const bucket = grouped.get(rawDate) || [];
    bucket.push(p);
    grouped.set(rawDate, bucket);
  }

  let totalBalanceMinutes = 0;
  const rows: string[][] = [];

  const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));
  for (const rawDate of sortedDates) {
    const dayPunches = grouped.get(rawDate) || [];
    const sortedDayPunches = [...dayPunches].sort(
      (a, b) => timeStringToMinutes(a.shortTime || a.time) - timeStringToMinutes(b.shortTime || b.time)
    );
    const refDate = parseLocalDate(rawDate);
    const isToday = rawDate === todayRaw;
    const balance = calculateDailyBalance(
      sortedDayPunches,
      schedule,
      refDate,
      isToday ? nowDate : undefined
    );
    totalBalanceMinutes += balance.balanceMinutes;

    const timesList = sortedDayPunches.map((p) => p.shortTime || p.time.slice(0, 5)).join(' • ');
    const dateBR = sortedDayPunches[0]?.dateStr || formatDateBrazilian(refDate);

    rows.push([
      normalizedUser,
      dateBR,
      rawDate,
      timesList,
      formatMinutesToHours(balance.workedMinutes, false),
      balance.isExtraDay ? 'Folga (00h 00m)' : formatMinutesToHours(balance.expectedMinutes, false),
      formatMinutesToHours(balance.balanceMinutes),
      balance.isExtraDay ? 'Sim (100% Extra)' : 'Não',
      balance.inProgress ? 'Em andamento' : 'Fechado',
      nowIso,
    ]);
  }

  return { totalBalanceMinutes, rows };
}

/**
 * Updates or inserts a single user row in the Usuarios table while preserving
 * all other users' rows untouched.
 */
export function mergeUsuariosTableRows(
  existingRows: string[][],
  profile: CloudUserProfile
): string[][] {
  const targetKey = normalizeUserKey(profile.usuario);
  const preserved: string[][] = [];

  for (let i = 1; i < (existingRows || []).length; i++) {
    const row = existingRows[i];
    if (!row || !row[0]) continue;
    if (normalizeUserKey(row[0]) !== targetKey) {
      preserved.push(row);
    }
  }

  const serialized = serializeUserProfileRow(profile);
  return [USUARIOS_HEADER, ...preserved, serialized];
}

/**
 * Replaces ONLY targetUserKey's rows in Batidas while preserving every other user's punches.
 */
export function mergeBatidasTableRows(
  existingRows: string[][],
  userKey: string,
  userPunches: PunchRecord[],
  nowIso = new Date().toISOString()
): string[][] {
  const targetKey = normalizeUserKey(userKey);
  const otherUsersRows: string[][] = [];

  for (let i = 1; i < (existingRows || []).length; i++) {
    const row = existingRows[i];
    if (!row || !row[0] || !row[1]) continue;
    if (normalizeUserKey(row[1]) !== targetKey) {
      otherUsersRows.push(row);
    }
  }

  const realUserPunches = sortPunchesNewestFirst(userPunches.filter((p) => !isDemoMockPunch(p)));
  const userRows = realUserPunches.map((p) => serializePunchRow(targetKey, p, nowIso));

  return [BATIDAS_HEADER, ...otherUsersRows, ...userRows];
}

/**
 * Replaces ONLY targetUserKey's rows in BancoDeHoras while preserving every other user's summary.
 */
export function mergeBancoDeHorasTableRows(
  existingRows: string[][],
  userKey: string,
  userSummaryRows: string[][]
): string[][] {
  const targetKey = normalizeUserKey(userKey);
  const otherUsersRows: string[][] = [];

  for (let i = 1; i < (existingRows || []).length; i++) {
    const row = existingRows[i];
    if (!row || !row[0]) continue;
    if (normalizeUserKey(row[0]) !== targetKey) {
      otherUsersRows.push(row);
    }
  }

  return [BANCO_HEADER, ...otherUsersRows, ...userSummaryRows];
}
