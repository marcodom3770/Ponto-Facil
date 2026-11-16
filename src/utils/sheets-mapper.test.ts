import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUserKey,
  extractSpreadsheetIdFromInput,
  parseUsersSheetRows,
  parsePunchSheetRows,
  mergeUserPunches,
  buildUserBancoDeHorasRows,
  mergeUsuariosTableRows,
  mergeBatidasTableRows,
  mergeBancoDeHorasTableRows,
  USUARIOS_HEADER,
  BATIDAS_HEADER,
  BANCO_HEADER,
  CloudUserProfile,
} from './sheets-mapper';
import { DEFAULT_WORK_SCHEDULE, PunchRecord } from './punch-rules';

test('normalizeUserKey unifies formatted and unformatted CPF and usernames', () => {
  assert.equal(normalizeUserKey('506.275.268-02'), '50627526802');
  assert.equal(normalizeUserKey('50627526802'), '50627526802');
  assert.equal(normalizeUserKey(' Marcos.Queiroz '), 'marcos.queiroz');
});

test('extractSpreadsheetIdFromInput extracts ID from URL or raw ID', () => {
  assert.equal(
    extractSpreadsheetIdFromInput(
      'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'
    ),
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
  );
  assert.equal(
    extractSpreadsheetIdFromInput('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'),
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
  );
  assert.equal(extractSpreadsheetIdFromInput('curto'), null);
});

test('parseUsersSheetRows parses user schedule and balances accurately', () => {
  const rows: string[][] = [
    USUARIOS_HEADER,
    [
      '506.275.268-02',
      'Marcos',
      '1,2,3,4,5,6',
      '09:00',
      '18:00',
      '60',
      '4',
      '120',
      '+02h 00m',
      '2026-11-10T10:00:00Z',
      '2026-11-16T10:00:00Z',
    ],
  ];

  const parsed = parseUsersSheetRows(rows);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].usuario, '50627526802');
  assert.deepEqual(parsed[0].schedule.workDays, [1, 2, 3, 4, 5, 6]);
  assert.equal(parsed[0].schedule.workStart, '09:00');
  assert.equal(parsed[0].saldoTotalMin, 120);
});

test('parsePunchSheetRows strictly isolates punches by target user key', () => {
  const rows: string[][] = [
    BATIDAS_HEADER,
    ['p1', '50627526802', '16 de novembro de 2026 - seg', '2026-11-16', '08:00:00', '08:00', 'entrada', 'confirmado', 'Não', '', ''],
    ['p2', '99988877766', '16 de novembro de 2026 - seg', '2026-11-16', '09:15:00', '09:15', 'entrada', 'confirmado', 'Não', '', ''],
  ];

  const marcosPunches = parsePunchSheetRows(rows, '506.275.268-02');
  assert.equal(marcosPunches.length, 1);
  assert.equal(marcosPunches[0].id, 'p1');
  assert.equal(marcosPunches[0].shortTime, '08:00');

  const otherUserPunches = parsePunchSheetRows(rows, '99988877766');
  assert.equal(otherUserPunches.length, 1);
  assert.equal(otherUserPunches[0].id, 'p2');

  const brandNewUser = parsePunchSheetRows(rows, '11122233344');
  assert.equal(brandNewUser.length, 0);
});

test('mergeUserPunches deduplicates cross-device punches and excludes demo mocks', () => {
  const localPunches: PunchRecord[] = [
    {
      id: 'mock-1',
      time: '07:39:12',
      shortTime: '07:39',
      dateStr: '10 de novembro de 2026 - ter',
      rawDate: '2026-11-10',
      isLunch: false,
      type: 'entrada',
      status: 'confirmado',
    },
    {
      id: 'local-new-2',
      time: '12:00:00',
      shortTime: '12:00',
      dateStr: '16 de novembro de 2026 - seg',
      rawDate: '2026-11-16',
      isLunch: true,
      type: 'almoco_ida',
      status: 'confirmado',
    },
    {
      id: 'local-dup-1',
      time: '08:00:10',
      shortTime: '08:00',
      dateStr: '16 de novembro de 2026 - seg',
      rawDate: '2026-11-16',
      isLunch: false,
      type: 'entrada',
      status: 'confirmado',
    },
  ];

  const cloudPunches: PunchRecord[] = [
    {
      id: 'cloud-1',
      time: '08:00:05',
      shortTime: '08:00',
      dateStr: '16 de novembro de 2026 - seg',
      rawDate: '2026-11-16',
      isLunch: false,
      type: 'entrada',
      status: 'confirmado',
    },
  ];

  const merged = mergeUserPunches(localPunches, cloudPunches);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].shortTime, '12:00');
  assert.equal(merged[1].id, 'cloud-1');
});

test('multi-user table merge adds new user and preserves other users punches and bank balances', () => {
  const existingUsers: string[][] = [
    USUARIOS_HEADER,
    ['11111111111', 'Colaborador A', '1,2,3,4,5', '08:00', '17:48', '60', '2', '30', '+00h 30m', '2026-11-10', '2026-11-10'],
  ];

  const newUserProfile: CloudUserProfile = {
    usuario: '222.222.222-22',
    nomeExibicao: 'Colaborador B',
    schedule: DEFAULT_WORK_SCHEDULE,
    totalBatidas: 2,
    saldoTotalMin: 240,
    saldoTotalFormatado: '+04h 00m',
    criadoEm: '2026-11-14T12:00:00Z',
    atualizadoEm: '2026-11-14T12:00:00Z',
  };

  const mergedUsers = mergeUsuariosTableRows(existingUsers, newUserProfile);
  assert.equal(mergedUsers.length, 3); // header + user A + user B
  assert.equal(mergedUsers[1][0], '11111111111');
  assert.equal(mergedUsers[2][0], '22222222222');

  const existingBatidas: string[][] = [
    BATIDAS_HEADER,
    ['a1', '11111111111', '14 de novembro de 2026 - sáb', '2026-11-14', '08:00:00', '08:00', 'entrada', 'confirmado', 'Não', '', ''],
  ];
  const userBPunches: PunchRecord[] = [
    {
      id: 'b1',
      time: '08:00:00',
      shortTime: '08:00',
      dateStr: '14 de novembro de 2026 - sáb',
      rawDate: '2026-11-14',
      isLunch: false,
      type: 'entrada',
      status: 'confirmado',
    },
    {
      id: 'b2',
      time: '12:00:00',
      shortTime: '12:00',
      dateStr: '14 de novembro de 2026 - sáb',
      rawDate: '2026-11-14',
      isLunch: false,
      type: 'saida',
      status: 'confirmado',
    },
  ];

  const mergedBatidas = mergeBatidasTableRows(existingBatidas, '22222222222', userBPunches, '2026-11-14T12:00:00Z');
  assert.equal(mergedBatidas.length, 4); // header + a1 (User A preserved!) + b2 + b1
  assert.equal(mergedBatidas[1][1], '11111111111');

  const userBSummary = buildUserBancoDeHorasRows(
    '22222222222',
    userBPunches,
    DEFAULT_WORK_SCHEDULE,
    new Date(2026, 10, 14, 15, 0, 0),
    '2026-11-14T15:00:00Z'
  );
  assert.equal(userBSummary.totalBalanceMinutes, 240);
  assert.equal(userBSummary.rows.length, 1);

  const existingBanco: string[][] = [
    BANCO_HEADER,
    ['11111111111', '14 de novembro de 2026 - sáb', '2026-11-14', '08:00 • 12:00', '04h 00m', 'Folga (00h 00m)', '+04h 00m', 'Sim (100% Extra)', 'Fechado', ''],
  ];
  const mergedBanco = mergeBancoDeHorasTableRows(existingBanco, '22222222222', userBSummary.rows);
  assert.equal(mergedBanco.length, 3); // header + User A + User B
  assert.equal(mergedBanco[1][0], '11111111111');
  assert.equal(mergedBanco[2][0], '22222222222');
});
