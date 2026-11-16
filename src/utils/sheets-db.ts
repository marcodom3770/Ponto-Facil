import { PunchRecord, WorkScheduleConfig, DEFAULT_WORK_SCHEDULE } from './punch-rules';
import {
  BANCO_HEADER,
  BATIDAS_HEADER,
  CloudUserProfile,
  DATABASE_SPREADSHEET_TITLE,
  SHEET_TABS,
  USUARIOS_HEADER,
  buildUserBancoDeHorasRows,
  mergeBancoDeHorasTableRows,
  mergeBatidasTableRows,
  mergeUserPunches,
  mergeUsuariosTableRows,
  normalizeUserKey,
  parsePunchSheetRows,
  parseUsersSheetRows,
} from './sheets-mapper';

export class GoogleAuthExpiredError extends Error {
  constructor(message = 'Sua sessão Google expirou. Clique em "Entrar com Google" para reconectar.') {
    super(message);
    this.name = 'GoogleAuthExpiredError';
  }
}

export interface SpreadsheetSummary {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetTabs: Array<{ sheetId: number; title: string }>;
}

export interface CloudDatabaseSnapshot {
  spreadsheet: SpreadsheetSummary;
  allUsers: CloudUserProfile[];
  activeUserProfile: CloudUserProfile | null;
  isNewUser: boolean;
  userPunches: PunchRecord[];
}

async function googleFetch(url: string, accessToken: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new GoogleAuthExpiredError();
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const apiMessage =
      json?.error?.message || `Erro Google API (${res.status}): ${res.statusText || 'Falha na requisição'}`;
    throw new Error(apiMessage);
  }

  return json;
}

export async function findDatabaseSpreadsheet(accessToken: string): Promise<SpreadsheetSummary | null> {
  const query = `name='${DATABASE_SPREADSHEET_TITLE.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,webViewLink,modifiedTime)&orderBy=modifiedTime desc&pageSize=5`;

  const data = await googleFetch(url, accessToken);
  const firstFile = data?.files?.[0];
  if (!firstFile?.id) return null;

  return getSpreadsheetMetadata(accessToken, firstFile.id);
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetSummary> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title)`;

  const data = await googleFetch(url, accessToken);
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    title: data.properties?.title || DATABASE_SPREADSHEET_TITLE,
    sheetTabs: (data.sheets || []).map((s: any) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title || '',
    })),
  };
}

async function readSheetValues(
  accessToken: string,
  spreadsheetId: string,
  tabName: string
): Promise<string[][]> {
  const range = encodeURIComponent(`'${tabName}'!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${range}`;
  const data = await googleFetch(url, accessToken);
  return Array.isArray(data?.values) ? data.values : [];
}

async function writeSheetValues(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  values: string[][]
): Promise<void> {
  const clearRange = encodeURIComponent(`'${tabName}'!A:Z`);
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${clearRange}:clear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );

  if (values.length === 0) return;

  const updateRange = encodeURIComponent(`'${tabName}'!A1`);
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${updateRange}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        range: `'${tabName}'!A1`,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );
}

async function styleHeaderRows(
  accessToken: string,
  spreadsheetId: string,
  sheetTabs: Array<{ sheetId: number; title: string }>
): Promise<void> {
  const targetTitles = new Set<string>([SHEET_TABS.USUARIOS, SHEET_TABS.BATIDAS, SHEET_TABS.BANCO]);
  const requests: any[] = [];

  for (const tab of sheetTabs) {
    if (!targetTitles.has(tab.title)) continue;
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: tab.sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });
    requests.push({
      repeatCell: {
        range: {
          sheetId: tab.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.08, green: 0.11, blue: 0.18 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });
  }

  if (requests.length === 0) return;

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ requests }),
    }
  );
}

export async function createDatabaseSpreadsheet(accessToken: string): Promise<SpreadsheetSummary> {
  const created = await googleFetch('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: DATABASE_SPREADSHEET_TITLE,
        locale: 'pt_BR',
      },
      sheets: [
        { properties: { title: SHEET_TABS.USUARIOS, index: 0 } },
        { properties: { title: SHEET_TABS.BATIDAS, index: 1 } },
        { properties: { title: SHEET_TABS.BANCO, index: 2 } },
      ],
    }),
  });

  const spreadsheetId = created.spreadsheetId;
  const sheetTabs = (created.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title || '',
  }));

  await Promise.all([
    writeSheetValues(accessToken, spreadsheetId, SHEET_TABS.USUARIOS, [USUARIOS_HEADER]),
    writeSheetValues(accessToken, spreadsheetId, SHEET_TABS.BATIDAS, [BATIDAS_HEADER]),
    writeSheetValues(accessToken, spreadsheetId, SHEET_TABS.BANCO, [BANCO_HEADER]),
  ]);

  await styleHeaderRows(accessToken, spreadsheetId, sheetTabs).catch(() => {
    // Non-fatal if styling call fails
  });

  return {
    spreadsheetId,
    spreadsheetUrl:
      created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    title: created.properties?.title || DATABASE_SPREADSHEET_TITLE,
    sheetTabs,
  };
}

export async function ensureRequiredTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetSummary> {
  let meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheetTabs.map((t) => t.title));

  const missingTabs = [SHEET_TABS.USUARIOS, SHEET_TABS.BATIDAS, SHEET_TABS.BANCO].filter(
    (title) => !existingTitles.has(title)
  );

  if (missingTabs.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((title) => ({
            addSheet: { properties: { title } },
          })),
        }),
      }
    );

    meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);

    for (const tabTitle of missingTabs) {
      const header =
        tabTitle === SHEET_TABS.USUARIOS
          ? USUARIOS_HEADER
          : tabTitle === SHEET_TABS.BATIDAS
            ? BATIDAS_HEADER
            : BANCO_HEADER;
      await writeSheetValues(accessToken, spreadsheetId, tabTitle, [header]);
    }

    await styleHeaderRows(accessToken, spreadsheetId, meta.sheetTabs).catch(() => {});
  }

  return meta;
}

/**
 * Read-only fetch of the active user's profile and punches from Google Sheets.
 * Strictly filters punches by the active Pernambucanas user key.
 */
export async function loadUserDatabaseFromSheets(
  accessToken: string,
  spreadsheetId: string,
  rawUsuario: string
): Promise<CloudDatabaseSnapshot> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheetTabs.map((t) => t.title));
  const hasUsuarios = existingTitles.has(SHEET_TABS.USUARIOS);
  const hasBatidas = existingTitles.has(SHEET_TABS.BATIDAS);

  const [usersRows, punchesRows] = await Promise.all([
    hasUsuarios ? readSheetValues(accessToken, spreadsheetId, SHEET_TABS.USUARIOS) : Promise.resolve([]),
    hasBatidas ? readSheetValues(accessToken, spreadsheetId, SHEET_TABS.BATIDAS) : Promise.resolve([]),
  ]);

  const allUsers = parseUsersSheetRows(usersRows);
  const userKey = normalizeUserKey(rawUsuario);
  const activeUserProfile = allUsers.find((u) => u.usuario === userKey) || null;
  const userPunches = userKey ? parsePunchSheetRows(punchesRows, userKey) : [];

  return {
    spreadsheet: meta,
    allUsers,
    activeUserProfile,
    isNewUser: Boolean(userKey && !activeUserProfile),
    userPunches,
  };
}

/**
 * Writes/updates the active user's profile, punches, and daily Banco de Horas summary
 * into Google Sheets while preserving every other user's rows untouched.
 * If replaceCloudPunches is false (default), merges local and cloud punches first.
 */
export async function syncUserDatabaseToSheets(
  accessToken: string,
  spreadsheetId: string,
  rawUsuario: string,
  localPunches: PunchRecord[],
  schedule: WorkScheduleConfig,
  options?: {
    nomeExibicao?: string;
    replaceCloudPunches?: boolean;
  }
): Promise<{
  spreadsheet: SpreadsheetSummary;
  allUsers: CloudUserProfile[];
  activeUserProfile: CloudUserProfile;
  syncedPunches: PunchRecord[];
}> {
  const userKey = normalizeUserKey(rawUsuario);
  if (!userKey) {
    throw new Error('Configure seu Login / CPF Pernambucanas antes de salvar na planilha.');
  }

  const meta = await ensureRequiredTabs(accessToken, spreadsheetId);

  const [existingUsersRows, existingBatidasRows, existingBancoRows] = await Promise.all([
    readSheetValues(accessToken, spreadsheetId, SHEET_TABS.USUARIOS),
    readSheetValues(accessToken, spreadsheetId, SHEET_TABS.BATIDAS),
    readSheetValues(accessToken, spreadsheetId, SHEET_TABS.BANCO),
  ]);

  const existingUsers = parseUsersSheetRows(existingUsersRows);
  const existingProfile = existingUsers.find((u) => u.usuario === userKey);
  const cloudUserPunches = parsePunchSheetRows(existingBatidasRows, userKey);

  const finalUserPunches = options?.replaceCloudPunches
    ? mergeUserPunches(localPunches, [])
    : mergeUserPunches(localPunches, cloudUserPunches);

  const now = new Date();
  const nowIso = now.toISOString();
  const effectiveSchedule = schedule || existingProfile?.schedule || DEFAULT_WORK_SCHEDULE;
  const { totalBalanceMinutes, rows: userBancoRows } = buildUserBancoDeHorasRows(
    userKey,
    finalUserPunches,
    effectiveSchedule,
    now,
    nowIso
  );

  const sign = totalBalanceMinutes > 0 ? '+' : totalBalanceMinutes < 0 ? '-' : '';
  const abs = Math.abs(totalBalanceMinutes);
  const formattedTotal =
    totalBalanceMinutes === 0
      ? '00h 00m'
      : `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}h ${String(abs % 60).padStart(2, '0')}m`;

  const nextProfile: CloudUserProfile = {
    usuario: userKey,
    nomeExibicao: options?.nomeExibicao || existingProfile?.nomeExibicao || rawUsuario.trim() || userKey,
    schedule: effectiveSchedule,
    totalBatidas: finalUserPunches.length,
    saldoTotalMin: totalBalanceMinutes,
    saldoTotalFormatado: formattedTotal,
    criadoEm: existingProfile?.criadoEm || nowIso,
    atualizadoEm: nowIso,
  };

  const nextUsersRows = mergeUsuariosTableRows(existingUsersRows, nextProfile);
  const nextBatidasRows = mergeBatidasTableRows(existingBatidasRows, userKey, finalUserPunches, nowIso);
  const nextBancoRows = mergeBancoDeHorasTableRows(existingBancoRows, userKey, userBancoRows);

  await Promise.all([
    writeSheetValues(accessToken, spreadsheetId, SHEET_TABS.USUARIOS, nextUsersRows),
    writeSheetValues(accessToken, spreadsheetId, SHEET_TABS.BATIDAS, nextBatidasRows),
    writeSheetValues(accessToken, spreadsheetId, SHEET_TABS.BANCO, nextBancoRows),
  ]);

  const updatedAllUsers = parseUsersSheetRows(nextUsersRows);

  return {
    spreadsheet: meta,
    allUsers: updatedAllUsers,
    activeUserProfile: nextProfile,
    syncedPunches: finalUserPunches,
  };
}
