import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTime,
  formatShortTime,
  formatDateBrazilian,
  calculateRemainingSeconds,
  calculateZeroSecondLunchTarget,
  computeLunchEndTimeFromTimeStr,
  shouldShowPreventiveLunchAlert,
  formatCountdown,
  getGreeting,
  timeStringToMinutes,
  formatMinutesToHours,
  isDayAWorkDay,
  getExpectedDailyWorkMinutes,
  calculatePunchesWorkedMinutes,
  calculateDailyBalance,
  calculateJourneyPrediction,
  DEFAULT_LUNCH_MINUTES,
  DEFAULT_WORK_SCHEDULE,
  PunchRecord,
  parsePortalPunchesFromSnapshot,
  normalizePortalMarcacoes,
  computeCustomAccentTokens,
  maskCredentialDisplay,
  findIncompleteWorkDays,
  buildWidgetPayload,
  formatLocalRawDate,
  parseRawDateFromBrazilianLabel,
  resolvePunchRawDate,
  calculateCombinedBankOfHours,
  buildExportBackupPayload,
  parseAndMergeBackupPayload,
  CURATED_THEME_PALETTES,
} from './punch-rules';

test('DEFAULT_LUNCH_MINUTES is 60 or 59 as configured', () => {
  assert.ok(DEFAULT_LUNCH_MINUTES === 60 || DEFAULT_LUNCH_MINUTES === 59);
});

test('calculateRemainingSeconds accurately computes 1-hour / 60-minute countdown', () => {
  const startTime = 1700000000000;
  assert.equal(calculateRemainingSeconds(startTime, 60, startTime), 60 * 60);
  const oneMinLater = startTime + 60 * 1000;
  assert.equal(calculateRemainingSeconds(startTime, 60, oneMinLater), 59 * 60);
  const oneHourLater = startTime + 60 * 60 * 1000;
  assert.equal(calculateRemainingSeconds(startTime, 60, oneHourLater), 0);
});

test('calculateZeroSecondLunchTarget zeroes seconds so 11:22:59 alarms at 12:22:00', () => {
  const punchDate = new Date(2026, 10, 17, 11, 22, 59, 800);
  const res = calculateZeroSecondLunchTarget(punchDate.getTime(), 60);

  assert.equal(res.expectedEndTimeStr, '12:22:00');
  const targetDate = new Date(res.targetEpoch);
  assert.equal(targetDate.getHours(), 12);
  assert.equal(targetDate.getMinutes(), 22);
  assert.equal(targetDate.getSeconds(), 0);
  assert.equal(targetDate.getMilliseconds(), 0);

  // At 12:21:59.500 (500ms before 12:22:00), must still show 1s and NOT fire early
  const beforeTarget = new Date(2026, 10, 17, 12, 21, 59, 500).getTime();
  assert.equal(calculateRemainingSeconds(res.startMinuteEpoch, 60, beforeTarget, res.targetEpoch), 1);

  // At 12:22:00.000 sharp, reaches 0 and triggers alarm
  const atTarget = new Date(2026, 10, 17, 12, 22, 0, 0).getTime();
  assert.equal(calculateRemainingSeconds(res.startMinuteEpoch, 60, atTarget, res.targetEpoch), 0);

  // Formatted helper matches HH:mm:00 for 60 and 59 min durations
  assert.equal(computeLunchEndTimeFromTimeStr('11:22:59', 60), '12:22:00');
  assert.equal(computeLunchEndTimeFromTimeStr('11:22:59', 59), '12:21:00');
});

test('shouldShowPreventiveLunchAlert activates strictly inside the final 60s window before 0s', () => {
  assert.equal(shouldShowPreventiveLunchAlert(61), false);
  assert.equal(shouldShowPreventiveLunchAlert(60), true);
  assert.equal(shouldShowPreventiveLunchAlert(30), true);
  assert.equal(shouldShowPreventiveLunchAlert(1), true);
  assert.equal(shouldShowPreventiveLunchAlert(0), false);
  assert.equal(shouldShowPreventiveLunchAlert(-5), false);
});

test('formatCountdown formats minutes and seconds with zero padding', () => {
  assert.equal(formatCountdown(3600), '60:00');
  assert.equal(formatCountdown(65), '01:05');
  assert.equal(formatCountdown(0), '00:00');
});

test('timeStringToMinutes converts string to minutes from midnight', () => {
  assert.equal(timeStringToMinutes('00:00'), 0);
  assert.equal(timeStringToMinutes('08:00'), 480);
  assert.equal(timeStringToMinutes('12:59:45'), 12 * 60 + 59);
  assert.equal(timeStringToMinutes('17:48'), 17 * 60 + 48);
});

test('formatMinutesToHours formats with sign', () => {
  assert.equal(formatMinutesToHours(0), '00h 00m');
  assert.equal(formatMinutesToHours(125), '+02h 05m');
  assert.equal(formatMinutesToHours(-45), '-00h 45m');
  assert.equal(formatMinutesToHours(-90), '-01h 30m');
});

test('isDayAWorkDay identifies week days vs weekend/days off', () => {
  // Tuesday (2) should be in default [1, 2, 3, 4, 5]
  const tuesday = new Date(2026, 10, 10);
  assert.equal(isDayAWorkDay(tuesday, DEFAULT_WORK_SCHEDULE.workDays), true);

  // Saturday (6) should NOT be in [1, 2, 3, 4, 5]
  const saturday = new Date(2026, 10, 14);
  assert.equal(isDayAWorkDay(saturday, DEFAULT_WORK_SCHEDULE.workDays), false);
});

test('getExpectedDailyWorkMinutes computes expected net time or 0 for days off', () => {
  const tuesday = new Date(2026, 10, 10);
  // 08:00 to 17:48 is 9h48m (588m) minus lunch
  const expTuesday = getExpectedDailyWorkMinutes(DEFAULT_WORK_SCHEDULE, tuesday);
  assert.equal(expTuesday, 588 - DEFAULT_WORK_SCHEDULE.lunchDurationMinutes);

  // Saturday is day off -> expected is 0
  const saturday = new Date(2026, 10, 14);
  assert.equal(getExpectedDailyWorkMinutes(DEFAULT_WORK_SCHEDULE, saturday), 0);
});

test('calculatePunchesWorkedMinutes calculates paired punch times', () => {
  const punches: PunchRecord[] = [
    { id: '1', time: '08:00:00', shortTime: '08:00', dateStr: '', isLunch: false, type: 'entrada', status: 'confirmado' },
    { id: '2', time: '12:00:00', shortTime: '12:00', dateStr: '', isLunch: true, type: 'almoco_ida', status: 'confirmado' },
    { id: '3', time: '13:00:00', shortTime: '13:00', dateStr: '', isLunch: false, type: 'almoco_volta', status: 'confirmado' },
    { id: '4', time: '17:00:00', shortTime: '17:00', dateStr: '', isLunch: false, type: 'saida', status: 'confirmado' },
  ];

  // 08:00 -> 12:00 = 4h (240m) + 13:00 -> 17:00 = 4h (240m) = 480m (8h)
  const result = calculatePunchesWorkedMinutes(punches);
  assert.equal(result.workedMinutes, 480);
  assert.equal(result.inProgress, false);
});

test('Saturday work is 100% banco de hora (extra day)', () => {
  const saturday = new Date(2026, 10, 14);
  const punches: PunchRecord[] = [
    { id: '1', time: '08:00:00', shortTime: '08:00', dateStr: '', isLunch: false, type: 'entrada', status: 'confirmado' },
    { id: '2', time: '12:00:00', shortTime: '12:00', dateStr: '', isLunch: false, type: 'saida', status: 'confirmado' },
  ];

  const balance = calculateDailyBalance(punches, DEFAULT_WORK_SCHEDULE, saturday);
  assert.equal(balance.isExtraDay, true);
  assert.equal(balance.workedMinutes, 240); // 4 hours
  assert.equal(balance.expectedMinutes, 0); // 0 expected
  assert.equal(balance.balanceMinutes, 240); // all 4 hours are positive banco de horas!
});

test('parsePortalPunchesFromSnapshot extracts 07:39 and 11:38 from portal dashboard text', () => {
  const sampleSnapshot = `
    - generic [ref=e1]:
      - heading "PORTAL NOSSA GENTE" [level=1]
      - region "MARCAÇÕES DO DIA 2 registros":
        - generic:
          - text "Próxima batida"
          - text "07:39"
          - button "Confirmar"
          - text "11:38"
          - text "Almoço"
          - button "Confirmar"
      - region "Banco de Horas":
        - text "Saldo atual: +05:20"
  `;

  const parsed = parsePortalPunchesFromSnapshot(sampleSnapshot);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].shortTime, '07:39');
  assert.equal(parsed[0].type, 'entrada');
  assert.equal(parsed[0].isLunch, false);

  assert.equal(parsed[1].shortTime, '11:38');
  assert.equal(parsed[1].type, 'almoco_ida');
  assert.equal(parsed[1].isLunch, true);
  assert.equal(parsed[1].status, 'confirmado');
});

test('parsePortalPunchesFromSnapshot returns empty array when no punches registered', () => {
  const emptySnapshot = `
    - region "MARCAÇÕES DO DIA 0 registros":
      - text "Nenhum registro encontrado para a data de hoje"
  `;
  const parsed = parsePortalPunchesFromSnapshot(emptySnapshot);
  assert.equal(parsed.length, 0);
});

test('normalizePortalMarcacoes handles Norber ISO timestamps, reversed lists, and HH:mm values', () => {
  const result = normalizePortalMarcacoes([
    '2026-11-13T11:38:00',
    '2026-11-13T07:39:12-03:00',
    '12:38',
    '07:39',
    '',
    null,
  ]);
  assert.equal(result.length, 3);
  assert.equal(result[0].shortTime, '07:39');
  assert.equal(result[0].type, 'entrada');
  assert.equal(result[1].shortTime, '11:38');
  assert.equal(result[1].type, 'almoco_ida');
  assert.equal(result[1].isLunch, true);
  assert.equal(result[2].shortTime, '12:38');
  assert.equal(result[2].type, 'almoco_volta');
  assert.equal(normalizePortalMarcacoes([]).length, 0);
});

test('calculateJourneyPrediction calculates next punch label and predicted exit time', () => {
  const tuesday = new Date(2026, 10, 10, 10, 0, 0); // 10:00 AM
  const onePunch: PunchRecord[] = [
    { id: '1', time: '08:00:00', shortTime: '08:00', dateStr: '', isLunch: false, type: 'entrada', status: 'confirmado' },
  ];
  const pred = calculateJourneyPrediction(onePunch, DEFAULT_WORK_SCHEDULE, tuesday, tuesday);
  assert.equal(pred.nextPunchLabel, 'Saída Almoço');
  assert.equal(pred.workedMinutes, 120);
  assert.equal(pred.predictedExitTimeStr, '17:48');
  assert.equal(pred.inProgress, true);
});

test('computeCustomAccentTokens computes accessible foreground ink for bright vs dark hex', () => {
  const brightYellow = computeCustomAccentTokens('#facc15', false);
  assert.equal(brightYellow.accentFg, '#09090b');
  assert.equal(brightYellow.hex, '#facc15');
  assert.notEqual(brightYellow.accentText, '#facc15'); // darkened on light surface

  const deepNavy = computeCustomAccentTokens('#1e3a8a', true);
  assert.equal(deepNavy.accentFg, '#ffffff');
  assert.notEqual(deepNavy.accentText, '#1e3a8a'); // lifted on dark surface
});

test('maskCredentialDisplay masks CPF in privacy mode and preserves value when off', () => {
  assert.equal(maskCredentialDisplay('50627526802', false), '50627526802');
  assert.equal(maskCredentialDisplay('50627526802', true), '•••.275.•••-••');
  assert.equal(maskCredentialDisplay('', true), 'Não configurado');
});

test('findIncompleteWorkDays flags past days with odd punch counts while ignoring today', () => {
  const punches: PunchRecord[] = [
    { id: 'p1', time: '08:00:00', shortTime: '08:00', dateStr: '09 de novembro de 2026 - seg', rawDate: '2026-11-09', isLunch: false, type: 'entrada', status: 'confirmado' },
    { id: 'p2', time: '12:00:00', shortTime: '12:00', dateStr: '09 de novembro de 2026 - seg', rawDate: '2026-11-09', isLunch: true, type: 'almoco_ida', status: 'confirmado' },
    { id: 'p3', time: '13:00:00', shortTime: '13:00', dateStr: '09 de novembro de 2026 - seg', rawDate: '2026-11-09', isLunch: true, type: 'almoco_volta', status: 'confirmado' },
    // Today has 1 punch, should NOT be flagged as incomplete past day
    { id: 'p4', time: '08:00:00', shortTime: '08:00', dateStr: '10 de novembro de 2026 - ter', rawDate: '2026-11-10', isLunch: false, type: 'entrada', status: 'confirmado' },
  ];
  const incomplete = findIncompleteWorkDays(punches, '2026-11-10');
  assert.equal(incomplete.length, 1);
  assert.equal(incomplete[0].rawDate, '2026-11-09');
  assert.equal(incomplete[0].punchCount, 3);
});

test('buildWidgetPayload builds live mobile widget slots and notification strings with privacy support', () => {
  const now = new Date(2026, 10, 10, 11, 50, 0);
  const punches: PunchRecord[] = [
    { id: 'p1', time: '07:39:00', shortTime: '07:39', dateStr: '10 de novembro de 2026 - ter', rawDate: '2026-11-10', isLunch: false, type: 'entrada', status: 'confirmado' },
    { id: 'p2', time: '11:38:00', shortTime: '11:38', dateStr: '10 de novembro de 2026 - ter', rawDate: '2026-11-10', isLunch: true, type: 'almoco_ida', status: 'confirmado' },
  ];

  const payload = buildWidgetPayload(punches, DEFAULT_WORK_SCHEDULE, now, false);
  assert.equal(payload.punchCount, 2);
  assert.equal(payload.slots[0].time, '07:39');
  assert.equal(payload.slots[1].time, '11:38');
  assert.equal(payload.slots[2].filled, false);
  assert.equal(payload.nextPunchLabel, 'Volta Almoço');
  assert.ok(payload.notificationTitle.includes('07:39'));

  const maskedPayload = buildWidgetPayload(punches, DEFAULT_WORK_SCHEDULE, now, true);
  assert.equal(maskedPayload.slots[0].time, '••:••');
  assert.ok(!maskedPayload.notificationTitle.includes('07:39'));
});

test('formatLocalRawDate and parseRawDateFromBrazilianLabel round-trip dates in local calendar', () => {
  const localLateNight = new Date(2026, 10, 10, 23, 45, 0); // Nov 10, 2026 23:45 local
  assert.equal(formatLocalRawDate(localLateNight), '2026-11-10');
  assert.equal(parseRawDateFromBrazilianLabel('10 de novembro de 2026 - ter'), '2026-11-10');
  assert.equal(parseRawDateFromBrazilianLabel('5 de janeiro de 2026 - seg'), '2026-01-05');
  assert.equal(resolvePunchRawDate([], '10 de novembro de 2026 - ter'), '2026-11-10');
});

test('calculateCombinedBankOfHours sums from startDateRaw onward and ignores earlier days', () => {
  const dailyEntries = [
    { rawDate: '2026-11-09', balanceMinutes: -60 }, // Segunda: anterior ao corte, não deve somar!
    { rawDate: '2026-11-10', balanceMinutes: 90 },  // Terça: +1h30m -> soma!
    { rawDate: '2026-11-11', balanceMinutes: 45 },  // Quarta: +0h45m -> soma!
  ];

  // Medição manual estava em +05h 00m (300 min), contando batidas do app a partir de Terça (2026-11-10)
  const res = calculateCombinedBankOfHours(dailyEntries, {
    initialMinutes: 300,
    startDateRaw: '2026-11-10',
  });

  assert.equal(res.ignoredDaysCount, 1);
  assert.equal(res.ignoredBeforeCutoffMinutes, -60);
  assert.equal(res.includedDaysCount, 2);
  assert.equal(res.appAccumulatedMinutes, 135); // +02h 15m
  assert.equal(res.totalCombinedMinutes, 435); // +07h 15m

  // Teste com saldo inicial negativo (-02h 30m = -150 min) e sem data de corte
  const negativeRes = calculateCombinedBankOfHours(dailyEntries, {
    initialMinutes: -150,
    startDateRaw: '',
  });
  assert.equal(negativeRes.includedDaysCount, 3);
  assert.equal(negativeRes.appAccumulatedMinutes, 75);
  assert.equal(negativeRes.totalCombinedMinutes, -75); // -01h 15m
});

test('CLT Art. 58 tolerance zeroes daily variance within ±10 min when enabled and preserves full variance beyond ±10 min', () => {
  const tuesday = new Date(2026, 10, 10);
  const cltSchedule = { ...DEFAULT_WORK_SCHEDULE, cltToleranceEnabled: true };

  // 08:00-12:00 (240m) + 13:00-17:41 (281m) = 521m vs 528m expected (-7m -> within ±10m tolerance!)
  const withinPunches: PunchRecord[] = [
    { id: '1', time: '08:00:00', shortTime: '08:00', dateStr: '', isLunch: false, type: 'entrada', status: 'confirmado' },
    { id: '2', time: '12:00:00', shortTime: '12:00', dateStr: '', isLunch: true, type: 'almoco_ida', status: 'confirmado' },
    { id: '3', time: '13:00:00', shortTime: '13:00', dateStr: '', isLunch: true, type: 'almoco_volta', status: 'confirmado' },
    { id: '4', time: '17:41:00', shortTime: '17:41', dateStr: '', isLunch: false, type: 'saida', status: 'confirmado' },
  ];
  const resWithin = calculateDailyBalance(withinPunches, cltSchedule, tuesday);
  assert.equal(resWithin.withinCltTolerance, true);
  assert.equal(resWithin.rawBalanceMinutes, -7);
  assert.equal(resWithin.balanceMinutes, 0);

  // 12 min short -> exceeds 10m tolerance, full -12m applies
  const outsidePunches: PunchRecord[] = [
    ...withinPunches.slice(0, 3),
    { id: '4', time: '17:36:00', shortTime: '17:36', dateStr: '', isLunch: false, type: 'saida', status: 'confirmado' },
  ];
  const resOutside = calculateDailyBalance(outsidePunches, cltSchedule, tuesday);
  assert.equal(resOutside.withinCltTolerance, false);
  assert.equal(resOutside.balanceMinutes, -12);
});

test('buildExportBackupPayload and parseAndMergeBackupPayload merge across devices without duplicates', () => {
  const existing: PunchRecord[] = [
    { id: 'p1', time: '07:39:00', shortTime: '07:39', dateStr: '10 de novembro de 2026 - ter', rawDate: '2026-11-10', isLunch: false, type: 'entrada', status: 'confirmado' },
  ];
  const exported = buildExportBackupPayload({
    punches: [
      ...existing,
      { id: 'p2', time: '11:38:00', shortTime: '11:38', dateStr: '10 de novembro de 2026 - ter', rawDate: '2026-11-10', isLunch: true, type: 'almoco_ida', status: 'confirmado' },
    ],
    workSchedule: { ...DEFAULT_WORK_SCHEDULE, cltToleranceEnabled: true },
    bancoBaseline: { initialMinutes: 300, startDateRaw: '2026-11-10' },
    visual: {
      themeColor: 'green',
      customAccentHex: '#10b981',
      isDarkMode: false,
      backgroundStyle: 'waves',
      clockStyle: 'analog',
      surfaceStyle: 'glass',
      radiusStyle: 'balanced',
      backdropSpeed: 'normal',
      backdropInteractive: true,
      matrixEnabled: true,
      matrixOpacity: 0.22,
    },
    settings: { lunchDurationMinutes: 60, humanMode: true, autoVisibility: 'background' },
  });

  const merged = parseAndMergeBackupPayload(JSON.stringify(exported), existing, 'merge');
  assert.equal(merged.valid, true);
  assert.equal(merged.punches.length, 2);
  assert.equal(merged.addedCount, 1);
  assert.equal(merged.skippedDuplicates, 1);
  assert.equal(merged.workSchedule?.cltToleranceEnabled, true);
  assert.equal(merged.bancoBaseline?.initialMinutes, 300);
  assert.equal(merged.visual?.themeColor, 'green');
  assert.equal(merged.settings?.autoVisibility, 'background');
});

test('CURATED_THEME_PALETTES includes vibrant and dark executive colors for light theme', () => {
  const vibrant = CURATED_THEME_PALETTES.filter((p) => p.group === 'vibrant');
  const darkLight = CURATED_THEME_PALETTES.filter((p) => p.group === 'dark-light');
  assert.equal(vibrant.length, 8);
  assert.equal(darkLight.length, 8);

  const ids = new Set(CURATED_THEME_PALETTES.map((p) => p.id));
  assert.equal(ids.size, 16);
  assert.ok(ids.has('onyx'));
  assert.ok(ids.has('navy'));
  assert.ok(ids.has('wine'));

  for (const palette of CURATED_THEME_PALETTES) {
    assert.match(palette.hex, /^#[0-9a-f]{6}$/i);
    assert.match(palette.darkHex, /^#[0-9a-f]{6}$/i);
  }
});





