/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useTransition, useMemo, useRef } from 'react';
import {
  Settings,
  ExternalLink,
  ShieldAlert,
  Play,
  RotateCw,
  HelpCircle,
  Sparkles,
  TrendingUp,
  Fingerprint,
  Sun,
  Moon,
  Palette,
  Smartphone,
  Eye,
  EyeOff,
  Pin,
  PictureInPicture2,
  X,
  CheckCircle2,
} from 'lucide-react';

import {
  formatTime,
  formatShortTime,
  formatDateBrazilian,
  calculateRemainingSeconds,
  calculateZeroSecondLunchTarget,
  DEFAULT_LUNCH_MINUTES,
  PunchRecord,
  ThemeColor,
  CURATED_THEME_PALETTES,
  BackgroundStyle,
  ClockStyle,
  SurfaceStyle,
  RadiusStyle,
  BackdropSpeed,
  VisualThemeConfig,
  AutoVisibility,
  AlarmSoundId,
  WorkScheduleConfig,
  DEFAULT_WORK_SCHEDULE,
  BancoDeHorasBaselineConfig,
  DEFAULT_BANCO_BASELINE,
  formatLocalRawDate,
  PortalFlowMode,
  normalizePortalMarcacoes,
  computeCustomAccentTokens,
  maskCredentialDisplay,
  findIncompleteWorkDays,
  buildWidgetPayload,
  BackupImportMode,
  buildExportBackupPayload,
  parseAndMergeBackupPayload,
} from './utils/punch-rules';
import {
  playPunchSuccessSound,
  startAlarmLoop,
  stopAlarmLoop,
  setAlarmSound,
  triggerSystemNotification,
  unlockAudioEngine,
  startLunchBackgroundKeepAlive,
  stopLunchBackgroundKeepAlive,
} from './utils/sound-alarm';
import { CredentialsModal } from './components/CredentialsModal';
import { LunchPromptModal } from './components/LunchPromptModal';
import { PersistentLunchNotification } from './components/PersistentLunchNotification';
import { AlarmReturnModal } from './components/AlarmReturnModal';
import { PunchHistoryCard } from './components/PunchHistoryCard';
import { SettingsModal, VisualPreviewPayload } from './components/SettingsModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { MatrixBackground } from './components/MatrixBackground';
import { BancoDeHorasPanel } from './components/BancoDeHorasPanel';
import { MobileWidgetStudio } from './components/MobileWidgetStudio';
import { VisualStudioPanel } from './components/VisualStudioPanel';
import { TestResultModal } from './components/TestResultModal';
import { PortalInteractiveModal } from './components/PortalInteractiveModal';
import {
  registerServiceWorker,
  startMobileLunchNotification,
  clearMobileLunchNotification,
  getMobileNotificationStatus,
  requestMobileNotificationPermission,
  checkMobileLunchNotification,
  fireMobileAlarmNotificationNow,
  syncMobileTodayWidget,
  clearMobileTodayWidget,
  MobileNotificationStatus,
} from './utils/service-worker-client';

const STORAGE_KEYS = {
  CREDS: 'ponto_pernambucanas_creds_v1',
  HISTORY: 'ponto_pernambucanas_history_v1',
  ACTIVE_LUNCH: 'ponto_pernambucanas_lunch_v1',
  CONFIG: 'ponto_pernambucanas_config_v1',
};

const PORTAL_URL =
  'https://pernambucanas.lgcloud.com.br/autenticacao/produtos/SAAA/principal2.aspx?c=pernambucanas';

type AppTab = 'ponto' | 'banco' | 'widget' | 'visual';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'banco' || tab === 'widget' || tab === 'visual') return tab;
    } catch {}
    return 'ponto';
  });

  // Current Live Clock State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const currentTime = formatTime(currentDate);
  const currentDateStr = formatDateBrazilian(currentDate);

  // Credentials State
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [showFirstSetupModal, setShowFirstSetupModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Theme & Visual Studio State
  const [themeColor, setThemeColor] = useState<ThemeColor>('yellow');
  const [customAccentHex, setCustomAccentHex] = useState<string>('#facc15');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>('constellation');
  const [clockStyle, setClockStyle] = useState<ClockStyle>('digital');
  const [surfaceStyle, setSurfaceStyle] = useState<SurfaceStyle>('glass');
  const [radiusStyle, setRadiusStyle] = useState<RadiusStyle>('balanced');
  const [backdropSpeed, setBackdropSpeed] = useState<BackdropSpeed>('normal');
  const [backdropInteractive, setBackdropInteractive] = useState<boolean>(true);
  const [matrixEnabled, setMatrixEnabled] = useState<boolean>(true);
  const [matrixOpacity, setMatrixOpacity] = useState<number>(0.22);
  const [alarmSoundId, setAlarmSoundIdState] = useState<AlarmSoundId>('notification');
  const [visualPreview, setVisualPreview] = useState<VisualPreviewPayload | null>(null);
  const [showQuickThemeMenu, setShowQuickThemeMenu] = useState(false);

  // Privacy Mode + Mobile Screen Widget + Floating Mini-Widget State
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const [widgetPinned, setWidgetPinned] = useState<boolean>(false);
  const [showFloatingMiniWidget, setShowFloatingMiniWidget] = useState<boolean>(false);
  const pipWindowRef = useRef<Window | null>(null);

  // Work Schedule & Banco de Horas State
  const [workSchedule, setWorkSchedule] = useState<WorkScheduleConfig>(DEFAULT_WORK_SCHEDULE);
  const [bancoBaseline, setBancoBaseline] = useState<BancoDeHorasBaselineConfig>(DEFAULT_BANCO_BASELINE);

  // App Settings
  const [lunchDurationMinutes, setLunchDurationMinutes] = useState(DEFAULT_LUNCH_MINUTES);
  const [useSimulation, setUseSimulation] = useState(false);

  // Punch Execution State
  const [isPunching, setIsPunching] = useState(false);
  const [isVerifyingPunches, setIsVerifyingPunches] = useState(false);
  const [punchProgressMessage, setPunchProgressMessage] = useState('');
  const [punchError, setPunchError] = useState<string | null>(null);
  const [appToast, setAppToast] = useState<string | null>(null);

  // Punch History
  const [punches, setPunches] = useState<PunchRecord[]>([]);

  const todayRawStr = useMemo(() => formatLocalRawDate(currentDate), [currentDate]);

  const todayPunches = useMemo(() => {
    const todayStr = currentDateStr.trim().toLowerCase();
    const nowDay = currentDate.getDate();
    const nowMonth = currentDate.getMonth();
    const nowYear = currentDate.getFullYear();

    return punches.filter((p) => {
      if (p.id === 'mock-1' || p.id === 'mock-2') return false;
      if (p.rawDate) return p.rawDate === todayRawStr;
      if (p.dateStr) return p.dateStr.trim().toLowerCase() === todayStr;

      const match = p.id.match(/^punch-(\d+)$/);
      if (match) {
        const d = new Date(Number(match[1]));
        return d.getDate() === nowDay && d.getMonth() === nowMonth && d.getFullYear() === nowYear;
      }
      return false;
    });
  }, [punches, currentDate, currentDateStr, todayRawStr]);

  const incompleteDays = useMemo(
    () => findIncompleteWorkDays(punches, todayRawStr),
    [punches, todayRawStr]
  );

  // Post-punch Lunch Prompt & Portal Modals
  const [showLunchPrompt, setShowLunchPrompt] = useState(false);
  const [lastPunchTime, setLastPunchTime] = useState('');
  const [lastPunchEpoch, setLastPunchEpoch] = useState<number | null>(null);
  const [showPortalInteractive, setShowPortalInteractive] = useState(false);
  const [portalFlowMode, setPortalFlowMode] = useState<PortalFlowMode>('auto_punch');

  // Lunch Countdown State
  const [lunchActive, setLunchActive] = useState(false);
  const [lunchStartEpoch, setLunchStartEpoch] = useState<number | null>(null);
  const [lunchTargetEpoch, setLunchTargetEpoch] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_LUNCH_MINUTES * 60);
  const [expectedEndTimeStr, setExpectedEndTimeStr] = useState('');
  const [lunchStartTimeStr, setLunchStartTimeStr] = useState('');
  const [showAlarmModal, setShowAlarmModal] = useState(false);

  // Mobile Notification Permission State
  const [notificationPermission, setNotificationPermission] = useState<MobileNotificationStatus>(() =>
    getMobileNotificationStatus()
  );

  // Execution Mode State (100% preserved)
  const [humanMode, setHumanMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pontofacil_human_mode');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [autoVisibility, setAutoVisibility] = useState<AutoVisibility>(() => {
    try {
      const saved = localStorage.getItem('pontofacil_auto_visibility');
      return saved === 'background' ? 'background' : 'visible';
    } catch {
      return 'visible';
    }
  });

  // Portal Test Result Modal State
  const [showTestModal, setShowTestModal] = useState(false);
  const [isTestingPortal, setIsTestingPortal] = useState(false);
  const [portalTestResult, setPortalTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    isDryRun?: boolean;
    buttonFound?: boolean;
    screenshot?: string;
    screenshots?: Array<{ label: string; dataUrl: string; time?: string }>;
    logs?: string[];
    time?: string;
    executionMode?: 'pessoa_fisica' | 'http';
  } | null>(null);

  const [, startTransition] = useTransition();

  const showTimedToast = useCallback((msg: string) => {
    setAppToast(msg);
    setTimeout(() => setAppToast((prev) => (prev === msg ? null : prev)), 4000);
  }, []);

  // Load persistent state on mount
  useEffect(() => {
    try {
      const storedCreds = localStorage.getItem(STORAGE_KEYS.CREDS);
      if (storedCreds) {
        const parsed = JSON.parse(storedCreds);
        if (parsed.usuario && parsed.senha) {
          setUsuario(parsed.usuario);
          setSenha(parsed.senha);
          setIsConfigured(true);
        } else {
          setShowFirstSetupModal(true);
        }
      } else {
        setShowFirstSetupModal(true);
      }

      const storedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (storedConfig) {
        const parsedCfg = JSON.parse(storedConfig);
        if (parsedCfg.lunchDurationMinutes) setLunchDurationMinutes(parsedCfg.lunchDurationMinutes);
        if (typeof parsedCfg.useSimulation === 'boolean') setUseSimulation(parsedCfg.useSimulation);
        if (parsedCfg.themeColor) setThemeColor(parsedCfg.themeColor);
        if (parsedCfg.customAccentHex) setCustomAccentHex(parsedCfg.customAccentHex);
        if (typeof parsedCfg.isDarkMode === 'boolean') setIsDarkMode(parsedCfg.isDarkMode);
        if (parsedCfg.backgroundStyle) setBackgroundStyle(parsedCfg.backgroundStyle);
        if (parsedCfg.clockStyle) setClockStyle(parsedCfg.clockStyle);
        if (parsedCfg.surfaceStyle) setSurfaceStyle(parsedCfg.surfaceStyle);
        if (parsedCfg.radiusStyle) setRadiusStyle(parsedCfg.radiusStyle);
        if (parsedCfg.backdropSpeed) setBackdropSpeed(parsedCfg.backdropSpeed);
        if (typeof parsedCfg.backdropInteractive === 'boolean') {
          setBackdropInteractive(parsedCfg.backdropInteractive);
        }
        if (typeof parsedCfg.privacyMode === 'boolean') setPrivacyMode(parsedCfg.privacyMode);
        if (typeof parsedCfg.widgetPinned === 'boolean') setWidgetPinned(parsedCfg.widgetPinned);
        if (parsedCfg.autoVisibility === 'background' || parsedCfg.autoVisibility === 'visible') {
          setAutoVisibility(parsedCfg.autoVisibility);
        }
        if (typeof parsedCfg.matrixEnabled === 'boolean') setMatrixEnabled(parsedCfg.matrixEnabled);
        if (typeof parsedCfg.matrixOpacity === 'number') setMatrixOpacity(parsedCfg.matrixOpacity);
        if (parsedCfg.alarmSoundId) {
          setAlarmSoundIdState(parsedCfg.alarmSoundId);
          setAlarmSound(parsedCfg.alarmSoundId);
        }
        if (parsedCfg.workSchedule) setWorkSchedule(parsedCfg.workSchedule);
        if (parsedCfg.bancoBaseline) setBancoBaseline(parsedCfg.bancoBaseline);
      }

      const storedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (storedHistory) {
        try {
          const parsed: PunchRecord[] = JSON.parse(storedHistory);
          let changed = false;
          const migrated = parsed.map((p) => {
            if ((p.id === 'mock-1' || p.id === 'mock-2') && p.rawDate !== '2026-11-10') {
              changed = true;
              return {
                ...p,
                dateStr: '10 de novembro de 2026 - ter',
                rawDate: '2026-11-10',
              };
            }
            return p;
          });
          if (changed) localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(migrated));
          setPunches(migrated);
        } catch {
          setPunches([]);
        }
      } else {
        const initialMock: PunchRecord[] = [
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
            id: 'mock-2',
            time: '11:38:05',
            shortTime: '11:38',
            dateStr: '10 de novembro de 2026 - ter',
            rawDate: '2026-11-10',
            isLunch: true,
            type: 'almoco_ida',
            status: 'confirmado',
          },
        ];
        setPunches(initialMock);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(initialMock));
      }

      const storedLunch = localStorage.getItem(STORAGE_KEYS.ACTIVE_LUNCH);
      if (storedLunch) {
        const parsedLunch = JSON.parse(storedLunch);
        const now = Date.now();
        const duration = parsedLunch.durationMinutes || DEFAULT_LUNCH_MINUTES;
        const zeroed = calculateZeroSecondLunchTarget(parsedLunch.startEpoch, duration);
        const targetEpoch =
          typeof parsedLunch.targetEpoch === 'number' && Number.isFinite(parsedLunch.targetEpoch)
            ? parsedLunch.targetEpoch
            : zeroed.targetEpoch;
        const startEpochToUse =
          typeof parsedLunch.targetEpoch === 'number' && Number.isFinite(parsedLunch.targetEpoch)
            ? parsedLunch.startEpoch
            : zeroed.startMinuteEpoch;
        const endStrToUse =
          typeof parsedLunch.targetEpoch === 'number' && Number.isFinite(parsedLunch.targetEpoch)
            ? parsedLunch.expectedEndTimeStr
            : zeroed.expectedEndTimeStr;

        const left = calculateRemainingSeconds(startEpochToUse, duration, now, targetEpoch);

        if (left > 0) {
          setLunchActive(true);
          setLunchStartEpoch(startEpochToUse);
          setLunchTargetEpoch(targetEpoch);
          setRemainingSeconds(left);
          setLunchDurationMinutes(duration);
          setLunchStartTimeStr(parsedLunch.startTimeStr);
          setExpectedEndTimeStr(endStrToUse);
          startMobileLunchNotification(startEpochToUse, duration, endStrToUse, targetEpoch);
          if (targetEpoch !== parsedLunch.targetEpoch) {
            localStorage.setItem(
              STORAGE_KEYS.ACTIVE_LUNCH,
              JSON.stringify({
                ...parsedLunch,
                startEpoch: startEpochToUse,
                targetEpoch,
                expectedEndTimeStr: endStrToUse,
              })
            );
          }
        } else {
          setLunchActive(false);
          setLunchTargetEpoch(null);
          setShowAlarmModal(true);
          startAlarmLoop(alarmSoundId);
          fireMobileAlarmNotificationNow(duration);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_LUNCH);
        }
      }
    } catch (e) {
      console.warn('Error reading from localStorage:', e);
      setShowFirstSetupModal(true);
    }
  }, [currentDateStr, alarmSoundId]);

  // Real-time clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerLunchCompletedAlarm = useCallback(
    (durationMins: number) => {
      setLunchActive(false);
      setLunchTargetEpoch(null);
      stopLunchBackgroundKeepAlive();
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_LUNCH);

      startAlarmLoop(alarmSoundId);
      setShowAlarmModal(true);
      const durLabel = durationMins === 60 ? '1 hora' : `${durationMins} min`;
      fireMobileAlarmNotificationNow(durationMins);
      triggerSystemNotification(
        `⏰ Intervalo de Almoço Concluído (${durLabel})!`,
        'Hora de retornar! Deseja abrir o portal e bater o ponto de retorno agora?'
      );
    },
    [alarmSoundId]
  );

  // Lunch Countdown ticker
  useEffect(() => {
    if (!lunchActive || !lunchStartEpoch) return;
    const tick = () => {
      const left = calculateRemainingSeconds(
        lunchStartEpoch,
        lunchDurationMinutes,
        Date.now(),
        lunchTargetEpoch ?? undefined
      );
      setRemainingSeconds(left);
      if (left <= 0) {
        triggerLunchCompletedAlarm(lunchDurationMinutes);
        return true;
      }
      return false;
    };
    const interval = setInterval(() => {
      if (tick()) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lunchActive, lunchStartEpoch, lunchTargetEpoch, lunchDurationMinutes, triggerLunchCompletedAlarm]);

  // Immediate catch-up on app foreground
  useEffect(() => {
    const handleResumeCheck = () => {
      setNotificationPermission(getMobileNotificationStatus());
      checkMobileLunchNotification();
      if (lunchActive && lunchStartEpoch) {
        const left = calculateRemainingSeconds(
          lunchStartEpoch,
          lunchDurationMinutes,
          Date.now(),
          lunchTargetEpoch ?? undefined
        );
        setRemainingSeconds(left);
        if (left <= 0) triggerLunchCompletedAlarm(lunchDurationMinutes);
      }
    };
    document.addEventListener('visibilitychange', handleResumeCheck);
    window.addEventListener('focus', handleResumeCheck);
    window.addEventListener('pageshow', handleResumeCheck);
    return () => {
      document.removeEventListener('visibilitychange', handleResumeCheck);
      window.removeEventListener('focus', handleResumeCheck);
      window.removeEventListener('pageshow', handleResumeCheck);
    };
  }, [lunchActive, lunchStartEpoch, lunchTargetEpoch, lunchDurationMinutes, triggerLunchCompletedAlarm]);

  // Sync live daily punch widget whenever today's punches / widgetPinned / privacyMode change
  useEffect(() => {
    const payload = buildWidgetPayload(todayPunches, workSchedule, currentDate, privacyMode);
    if (widgetPinned) {
      syncMobileTodayWidget(payload, true);
    } else {
      syncMobileTodayWidget(payload, false);
    }
    // Keep Document PiP updated if active
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      const doc = pipWindowRef.current.document;
      const clockEl = doc.getElementById('pf-pip-clock');
      const punchesEl = doc.getElementById('pf-pip-punches');
      const statusEl = doc.getElementById('pf-pip-status');
      if (clockEl) clockEl.textContent = privacyMode ? '••:••:••' : currentTime;
      if (punchesEl) punchesEl.textContent = payload.punchListText;
      if (statusEl) statusEl.textContent = `Trab: ${payload.workedText} · Próx: ${payload.nextPunchLabel}`;
    }
  }, [todayPunches, workSchedule, widgetPinned, privacyMode, currentTime, currentDate]);

  const handleSaveCredentials = (credentials: { usuario: string; senha: string }) => {
    setUsuario(credentials.usuario);
    setSenha(credentials.senha);
    setIsConfigured(true);
    localStorage.setItem(STORAGE_KEYS.CREDS, JSON.stringify(credentials));
  };

  const persistConfigPatch = useCallback((patch: Record<string, unknown>) => {
    try {
      const existingRaw = localStorage.getItem(STORAGE_KEYS.CONFIG);
      const parsed = existingRaw ? JSON.parse(existingRaw) : {};
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ ...parsed, ...patch }));
    } catch {}
  }, []);

  const handleUpdateVisual = useCallback(
    (patch: Partial<VisualThemeConfig>) => {
      if (patch.themeColor !== undefined) setThemeColor(patch.themeColor);
      if (patch.customAccentHex !== undefined) setCustomAccentHex(patch.customAccentHex);
      if (patch.isDarkMode !== undefined) setIsDarkMode(patch.isDarkMode);
      if (patch.backgroundStyle !== undefined) setBackgroundStyle(patch.backgroundStyle);
      if (patch.clockStyle !== undefined) setClockStyle(patch.clockStyle);
      if (patch.surfaceStyle !== undefined) setSurfaceStyle(patch.surfaceStyle);
      if (patch.radiusStyle !== undefined) setRadiusStyle(patch.radiusStyle);
      if (patch.backdropSpeed !== undefined) setBackdropSpeed(patch.backdropSpeed);
      if (patch.backdropInteractive !== undefined) setBackdropInteractive(patch.backdropInteractive);
      if (patch.matrixEnabled !== undefined) setMatrixEnabled(patch.matrixEnabled);
      if (patch.matrixOpacity !== undefined) setMatrixOpacity(patch.matrixOpacity);

      persistConfigPatch(patch);
    },
    [persistConfigPatch]
  );

  const handleSaveSettings = (settings: {
    usuario: string;
    senha: string;
    lunchDurationMinutes: number;
    useSimulation: boolean;
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
    alarmSoundId: AlarmSoundId;
    workSchedule: WorkScheduleConfig;
    humanMode: boolean;
    autoVisibility: AutoVisibility;
  }) => {
    setVisualPreview(null);
    setUsuario(settings.usuario);
    setSenha(settings.senha);
    setLunchDurationMinutes(settings.lunchDurationMinutes);
    setUseSimulation(settings.useSimulation);
    setHumanMode(settings.humanMode);
    setAutoVisibility(settings.autoVisibility);
    setThemeColor(settings.themeColor);
    setCustomAccentHex(settings.customAccentHex);
    setIsDarkMode(settings.isDarkMode);
    setBackgroundStyle(settings.backgroundStyle);
    setClockStyle(settings.clockStyle);
    setSurfaceStyle(settings.surfaceStyle);
    setRadiusStyle(settings.radiusStyle);
    setBackdropSpeed(settings.backdropSpeed);
    setBackdropInteractive(settings.backdropInteractive);
    setMatrixEnabled(settings.matrixEnabled);
    setMatrixOpacity(settings.matrixOpacity);
    setAlarmSoundIdState(settings.alarmSoundId);
    setAlarmSound(settings.alarmSoundId);
    setWorkSchedule(settings.workSchedule);

    localStorage.setItem('pontofacil_human_mode', String(settings.humanMode));
    localStorage.setItem('pontofacil_auto_visibility', settings.autoVisibility);
    localStorage.setItem(
      STORAGE_KEYS.CREDS,
      JSON.stringify({ usuario: settings.usuario, senha: settings.senha })
    );
    persistConfigPatch({
      lunchDurationMinutes: settings.lunchDurationMinutes,
      useSimulation: settings.useSimulation,
      themeColor: settings.themeColor,
      customAccentHex: settings.customAccentHex,
      isDarkMode: settings.isDarkMode,
      backgroundStyle: settings.backgroundStyle,
      clockStyle: settings.clockStyle,
      surfaceStyle: settings.surfaceStyle,
      radiusStyle: settings.radiusStyle,
      backdropSpeed: settings.backdropSpeed,
      backdropInteractive: settings.backdropInteractive,
      autoVisibility: settings.autoVisibility,
      matrixEnabled: settings.matrixEnabled,
      matrixOpacity: settings.matrixOpacity,
      alarmSoundId: settings.alarmSoundId,
      workSchedule: settings.workSchedule,
    });
  };

  const handleClearHistory = () => {
    setPunches([]);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  };

  const handleDeletePunch = (id: string) => {
    const updated = punches.filter((p) => p.id !== id);
    setPunches(updated);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  };

  const handleClearSimulated = () => {
    const updated = punches.filter((p) => p.status !== 'simulado');
    setPunches(updated);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  };

  const handleChangeExecutionOption = (nextHuman: boolean, nextVis: AutoVisibility) => {
    setHumanMode(nextHuman);
    setAutoVisibility(nextVis);
    localStorage.setItem('pontofacil_human_mode', String(nextHuman));
    localStorage.setItem('pontofacil_auto_visibility', nextVis);
    persistConfigPatch({ autoVisibility: nextVis });
  };

  const handleAddManualPunch = (punch: Omit<PunchRecord, 'id'>) => {
    const newRecord: PunchRecord = { ...punch, id: `manual-${Date.now()}` };
    const updated = [newRecord, ...punches];
    setPunches(updated);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  };

  const handleUpdateSchedule = (newSchedule: WorkScheduleConfig) => {
    setWorkSchedule(newSchedule);
    persistConfigPatch({ workSchedule: newSchedule });
  };

  const handleUpdateBancoBaseline = (nextBaseline: BancoDeHorasBaselineConfig) => {
    setBancoBaseline(nextBaseline);
    persistConfigPatch({ bancoBaseline: nextBaseline });
    showTimedToast('Medição inicial e data de corte do Banco de Horas atualizadas!');
  };

  const handleExportBackup = () => {
    const backup = buildExportBackupPayload({
      punches,
      workSchedule,
      bancoBaseline,
      visual: currentVisualConfig,
      settings: {
        lunchDurationMinutes,
        useSimulation,
        humanMode,
        autoVisibility,
        alarmSoundId,
        privacyMode,
        widgetPinned,
      },
    });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pontofacil_dados_${formatLocalRawDate(new Date())}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showTimedToast('Arquivo .json completo exportado com sucesso!');
  };

  const handleImportBackup = (file: File, mode: BackupImportMode = 'merge') => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseAndMergeBackupPayload(String(reader.result || ''), punches, mode);
      if (!result.valid) {
        showTimedToast(
          result.error || 'Arquivo .json inválido. Selecione um arquivo exportado pelo PontoFácil.'
        );
        return;
      }

      setPunches(result.punches);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(result.punches));

      if (result.workSchedule) {
        setWorkSchedule(result.workSchedule);
        persistConfigPatch({ workSchedule: result.workSchedule });
      }
      if (result.bancoBaseline) {
        setBancoBaseline(result.bancoBaseline);
        persistConfigPatch({ bancoBaseline: result.bancoBaseline });
      }
      if (result.visual) {
        handleUpdateVisual(result.visual);
      }
      if (result.settings) {
        const s = result.settings;
        if (typeof s.lunchDurationMinutes === 'number') {
          setLunchDurationMinutes(s.lunchDurationMinutes);
          persistConfigPatch({ lunchDurationMinutes: s.lunchDurationMinutes });
        }
        if (typeof s.useSimulation === 'boolean') {
          setUseSimulation(s.useSimulation);
          persistConfigPatch({ useSimulation: s.useSimulation });
        }
        if (typeof s.humanMode === 'boolean') {
          setHumanMode(s.humanMode);
          localStorage.setItem('pontofacil_human_mode', String(s.humanMode));
        }
        if (s.autoVisibility === 'visible' || s.autoVisibility === 'background') {
          setAutoVisibility(s.autoVisibility);
          localStorage.setItem('pontofacil_auto_visibility', s.autoVisibility);
          persistConfigPatch({ autoVisibility: s.autoVisibility });
        }
        if (s.alarmSoundId) {
          setAlarmSoundIdState(s.alarmSoundId);
          setAlarmSound(s.alarmSoundId);
          persistConfigPatch({ alarmSoundId: s.alarmSoundId });
        }
        if (typeof s.privacyMode === 'boolean') {
          setPrivacyMode(s.privacyMode);
          persistConfigPatch({ privacyMode: s.privacyMode });
        }
        if (typeof s.widgetPinned === 'boolean') {
          setWidgetPinned(s.widgetPinned);
          persistConfigPatch({ widgetPinned: s.widgetPinned });
        }
      }

      if (mode === 'replace') {
        showTimedToast(
          `Arquivo .json restaurado (${result.addedCount} batidas e configurações aplicadas)!`
        );
      } else {
        showTimedToast(
          `Importação .json concluída: +${result.addedCount} batida(s) importada(s)${
            result.skippedDuplicates > 0 ? `, ${result.skippedDuplicates} duplicada(s) ignorada(s)` : ''
          }!`
        );
      }
    };
    reader.readAsText(file);
  };

  const handleSyncPunchesFromPortal = useCallback(
    (portalPunches: string[]) => {
      const normalized = normalizePortalMarcacoes(portalPunches);
      if (normalized.length === 0) return;

      const todayRaw = formatLocalRawDate(currentDate);
      setPunches((prev) => {
        const todayExistingTimes = new Set(
          prev
            .filter((p) => {
              if (p.id === 'mock-1' || p.id === 'mock-2') return false;
              if (p.rawDate) return p.rawDate === todayRaw;
              if (p.dateStr) return p.dateStr.trim().toLowerCase() === currentDateStr.trim().toLowerCase();
              return false;
            })
            .map((p) => p.shortTime || p.time.slice(0, 5))
        );

        const toAdd: PunchRecord[] = [];
        normalized.forEach((item, index) => {
          if (!todayExistingTimes.has(item.shortTime)) {
            toAdd.push({
              id: `punch-portal-sync-${Date.now()}-${index}`,
              time: item.time,
              shortTime: item.shortTime,
              dateStr: currentDateStr,
              rawDate: todayRaw,
              isLunch: item.isLunch,
              type: item.type,
              status: 'confirmado',
              note: 'Sincronizado do Portal Nossa Gente',
            });
          }
        });

        if (toAdd.length === 0) return prev;
        const updated = [...toAdd.reverse(), ...prev];
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
        playPunchSuccessSound();
        return updated;
      });
    },
    [currentDate, currentDateStr]
  );

  const handleConfirmPunchFromX = useCallback(
    (
      punchDate: Date,
      options?: boolean | { isAuto?: boolean; isSimulated?: boolean; portalPunches?: string[] }
    ) => {
      setShowPortalInteractive(false);
      const isSimulated = typeof options === 'boolean' ? options : Boolean(options?.isSimulated);
      const isAuto = typeof options === 'object' ? Boolean(options?.isAuto) : false;
      const portalPunches = typeof options === 'object' && Array.isArray(options?.portalPunches) ? options.portalPunches : [];

      const recordedTime = formatTime(punchDate);
      const shortT = formatShortTime(punchDate);
      const todayRaw = formatLocalRawDate(punchDate);
      const dateStr = formatDateBrazilian(punchDate);

      setPunches((prev) => {
        const existingToday = prev.filter((p) => {
          if (p.id === 'mock-1' || p.id === 'mock-2') return false;
          if (p.rawDate) return p.rawDate === todayRaw;
          if (p.dateStr) return p.dateStr.trim().toLowerCase() === dateStr.trim().toLowerCase();
          return false;
        });
        const existingTimes = new Set(existingToday.map((p) => p.shortTime || p.time.slice(0, 5)));

        const normalizedPortal = normalizePortalMarcacoes(portalPunches);
        const extraFromPortal: PunchRecord[] = [];
        normalizedPortal.forEach((item, idx) => {
          if (item.shortTime !== shortT && !existingTimes.has(item.shortTime)) {
            extraFromPortal.push({
              id: `punch-portal-sync-${punchDate.getTime()}-${idx}`,
              time: item.time,
              shortTime: item.shortTime,
              dateStr,
              rawDate: todayRaw,
              isLunch: item.isLunch,
              type: item.type,
              status: 'confirmado',
              note: 'Sincronizado do Portal Nossa Gente',
            });
          }
        });

        const countBefore = existingToday.length + extraFromPortal.length;
        let punchType: 'entrada' | 'almoco_ida' | 'almoco_volta' | 'saida' = 'entrada';
        if (countBefore === 1) punchType = 'almoco_ida';
        else if (countBefore === 2) punchType = 'almoco_volta';
        else if (countBefore >= 3) punchType = 'saida';

        const newRecord: PunchRecord = {
          id: `punch-${punchDate.getTime()}`,
          time: recordedTime,
          shortTime: shortT,
          dateStr,
          rawDate: todayRaw,
          isLunch: punchType === 'almoco_ida',
          type: punchType,
          status: isSimulated ? 'simulado' : 'confirmado',
          note: isSimulated
            ? 'Simulação de teste'
            : isAuto
              ? 'Batido automaticamente no Portal Nossa Gente (Marcar ponto + Sim)'
              : 'Gravado via confirmação no ✕ da tela oficial',
        };

        const updated = [newRecord, ...extraFromPortal, ...prev];
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
        return updated;
      });

      playPunchSuccessSound();
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate([45, 35, 70]);
        }
      } catch {}
      setLastPunchTime(recordedTime);
      setLastPunchEpoch(punchDate.getTime());
      setShowLunchPrompt(true);
    },
    []
  );

  const handleInitiatePunch = useCallback(
    async (modeOverride?: 'real' | 'simulado' | 'teste_conexao_portal') => {
      if (!usuario || !senha) {
        setShowFirstSetupModal(true);
        return;
      }

      stopAlarmLoop();
      setShowAlarmModal(false);

      const effectiveMode = modeOverride || (useSimulation ? 'simulado' : 'real');

      if (effectiveMode === 'simulado') {
        setIsPunching(true);
        setPunchError(null);
        setPunchProgressMessage('Simulando marcação de ponto de teste...');
        setTimeout(() => {
          setIsPunching(false);
          setPunchProgressMessage('');
          handleConfirmPunchFromX(new Date(), { isSimulated: true });
        }, 800);
        return;
      }

      if (effectiveMode === 'teste_conexao_portal') {
        setPortalFlowMode('test_connection');
        setShowPortalInteractive(true);
        return;
      }

      setPortalFlowMode(humanMode ? 'auto_punch' : 'manual_punch');
      setShowPortalInteractive(true);
    },
    [usuario, senha, useSimulation, humanMode, handleConfirmPunchFromX]
  );

  const handleTestPortalConnection = async (options?: {
    credentials?: { usuario: string; senha: string };
    forceHuman?: boolean;
  }) => {
    const targetUser = options?.credentials?.usuario ?? usuario;
    const targetPass = options?.credentials?.senha ?? senha;
    if (!targetUser || !targetPass) {
      setShowFirstSetupModal(true);
      return;
    }
    setShowTestModal(false);
    setPortalFlowMode('test_connection');
    setShowPortalInteractive(true);
  };

  const handleUpdateCredentialsAndRetry = (newUsuario: string, newSenha: string) => {
    handleSaveCredentials({ usuario: newUsuario, senha: newSenha });
    handleTestPortalConnection({ credentials: { usuario: newUsuario, senha: newSenha } });
  };

  const handleVerifyPunchesToday = async () => {
    if (!usuario || !senha) {
      setShowFirstSetupModal(true);
      return;
    }

    if (useSimulation) {
      setIsVerifyingPunches(true);
      setPunchProgressMessage('Consultando batidas simuladas...');
      try {
        const response = await fetch('/api/ponto/marcar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario, senha, mode: 'verificar_pontos_simulado' }),
        });
        const data = await response.json();
        if (data.success && Array.isArray(data.punchesFound)) {
          handleSyncPunchesFromPortal(data.punchesFound.map((p: { shortTime: string }) => p.shortTime));
          setPortalTestResult({ success: true, message: data.message, isDryRun: true });
          setShowTestModal(true);
        }
      } finally {
        setIsVerifyingPunches(false);
        setPunchProgressMessage('');
      }
      return;
    }

    setPortalFlowMode('verify_punches');
    setShowPortalInteractive(true);
  };

  // SW registration & actions
  useEffect(() => {
    registerServiceWorker();
    setNotificationPermission(getMobileNotificationStatus());

    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'bater_ponto') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => handleInitiatePunch(), 600);
    }

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.action === 'bater_ponto') {
          handleInitiatePunch();
        } else if (event.data?.action === 'abrir_widget') {
          setActiveTab('widget');
        } else if (event.data?.type === 'LUNCH_ALARM_FIRED') {
          setLunchActive(false);
          stopLunchBackgroundKeepAlive();
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_LUNCH);
          startAlarmLoop(alarmSoundId);
          setShowAlarmModal(true);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, [handleInitiatePunch, alarmSoundId]);

  const handleEnableMobileNotifications = async () => {
    unlockAudioEngine();
    const perm = await requestMobileNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      if (lunchActive && lunchStartEpoch) {
        await startMobileLunchNotification(
          lunchStartEpoch,
          lunchDurationMinutes,
          expectedEndTimeStr,
          lunchTargetEpoch ?? undefined
        );
      }
      if (widgetPinned) {
        const payload = buildWidgetPayload(todayPunches, workSchedule, currentDate, privacyMode);
        await syncMobileTodayWidget(payload, true);
      }
    } else if (perm === 'denied') {
      setShowSettingsModal(true);
    }
  };

  const handleTogglePinWidget = async (pinned: boolean) => {
    unlockAudioEngine();
    if (pinned) {
      const perm =
        getMobileNotificationStatus() === 'granted'
          ? 'granted'
          : await requestMobileNotificationPermission();
      setNotificationPermission(perm);
      setWidgetPinned(true);
      persistConfigPatch({ widgetPinned: true });
      const payload = buildWidgetPayload(todayPunches, workSchedule, currentDate, privacyMode);
      await syncMobileTodayWidget(payload, perm === 'granted');
    } else {
      setWidgetPinned(false);
      persistConfigPatch({ widgetPinned: false });
      await clearMobileTodayWidget();
    }
  };

  const handleForceSyncWidget = async () => {
    const perm = getMobileNotificationStatus();
    setNotificationPermission(perm);
    const payload = buildWidgetPayload(todayPunches, workSchedule, currentDate, privacyMode);
    await syncMobileTodayWidget(payload, widgetPinned && perm === 'granted');
  };

  const handleOpenFloatingMiniWidget = async () => {
    const pip = (window as unknown as {
      documentPictureInPicture?: { requestWindow: (opts: { width: number; height: number }) => Promise<Window> };
    }).documentPictureInPicture;

    if (pip && typeof pip.requestWindow === 'function') {
      try {
        const win = await pip.requestWindow({ width: 320, height: 220 });
        pipWindowRef.current = win;
        const payload = buildWidgetPayload(todayPunches, workSchedule, currentDate, privacyMode);
        win.document.body.innerHTML = `
          <div style="margin:0;padding:16px;font-family:system-ui,sans-serif;background:#0b0e14;color:#f8fafc;height:100vh;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:10px;font-weight:800;letter-spacing:1px;color:#facc15;">PONTOFÁCIL · HOJE</span>
              <span id="pf-pip-clock" style="font-family:monospace;font-size:16px;font-weight:800;">${privacyMode ? '••:••:••' : currentTime}</span>
            </div>
            <div id="pf-pip-punches" style="font-family:monospace;font-size:12px;background:rgba(255,255,255,0.06);padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);">${payload.punchListText}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <span id="pf-pip-status" style="font-size:11px;color:#cbd5e1;">Trab: ${payload.workedText} · Próx: ${payload.nextPunchLabel}</span>
              <button id="pf-pip-btn" style="background:#facc15;color:#09090b;border:0;border-radius:8px;padding:7px 12px;font-weight:800;font-size:11px;cursor:pointer;">Bater</button>
            </div>
          </div>
        `;
        win.document.getElementById('pf-pip-btn')?.addEventListener('click', () => {
          window.focus();
          handleInitiatePunch();
        });
        return;
      } catch {
        // Fallback to in-app floating mini-widget below
      }
    }
    setShowFloatingMiniWidget(true);
  };

  // Lunch handlers (100% preserved)
  const handleConfirmLunch = async () => {
    setShowLunchPrompt(false);
    unlockAudioEngine();

    if (getMobileNotificationStatus() === 'default') {
      const perm = await requestMobileNotificationPermission();
      setNotificationPermission(perm);
    }

    const now = Date.now();
    const punchEpoch =
      lastPunchEpoch && Math.abs(now - lastPunchEpoch) < 15 * 60 * 1000 ? lastPunchEpoch : now;
    const duration = lunchDurationMinutes;
    const { startMinuteEpoch, targetEpoch, expectedEndTimeStr: endStr } =
      calculateZeroSecondLunchTarget(punchEpoch, duration);

    const startStr = lastPunchTime || formatTime(new Date(punchEpoch));
    const initialRemaining = calculateRemainingSeconds(startMinuteEpoch, duration, now, targetEpoch);

    setLunchActive(true);
    setLunchStartEpoch(startMinuteEpoch);
    setLunchTargetEpoch(targetEpoch);
    setRemainingSeconds(initialRemaining);
    setLunchStartTimeStr(startStr);
    setExpectedEndTimeStr(endStr);

    startLunchBackgroundKeepAlive(endStr);
    startMobileLunchNotification(startMinuteEpoch, duration, endStr, targetEpoch);

    if (punches.length > 0) {
      const updated = [...punches];
      updated[0] = { ...updated[0], isLunch: true, type: 'almoco_ida' };
      setPunches(updated);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
    }

    localStorage.setItem(
      STORAGE_KEYS.ACTIVE_LUNCH,
      JSON.stringify({
        startEpoch: startMinuteEpoch,
        targetEpoch,
        durationMinutes: duration,
        startTimeStr: startStr,
        expectedEndTimeStr: endStr,
      })
    );
  };

  const handleDismissLunch = () => setShowLunchPrompt(false);

  const handleCancelLunch = () => {
    setLunchActive(false);
    setLunchStartEpoch(null);
    setLunchTargetEpoch(null);
    stopLunchBackgroundKeepAlive();
    clearMobileLunchNotification();
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_LUNCH);
  };

  const handleFastForwardDemo = () => {
    unlockAudioEngine();
    const demoTarget = Date.now() + 5000;
    const fakeStart = demoTarget - lunchDurationMinutes * 60 * 1000;
    const newEndStr = formatTime(new Date(demoTarget));
    setLunchStartEpoch(fakeStart);
    setLunchTargetEpoch(demoTarget);
    setRemainingSeconds(5);
    setExpectedEndTimeStr(newEndStr);

    localStorage.setItem(
      STORAGE_KEYS.ACTIVE_LUNCH,
      JSON.stringify({
        startEpoch: fakeStart,
        targetEpoch: demoTarget,
        durationMinutes: lunchDurationMinutes,
        startTimeStr: lunchStartTimeStr,
        expectedEndTimeStr: newEndStr,
      })
    );

    startLunchBackgroundKeepAlive(newEndStr);
    startMobileLunchNotification(fakeStart, lunchDurationMinutes, newEndStr, demoTarget);
  };

  const handleInitiatePunchFromAlarm = () => {
    stopAlarmLoop();
    stopLunchBackgroundKeepAlive();
    setShowAlarmModal(false);
    setLunchActive(false);
    setLunchTargetEpoch(null);
    clearMobileLunchNotification();
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_LUNCH);
    startTransition(() => {
      handleInitiatePunch();
    });
  };

  const handleDismissAlarmOnly = () => {
    stopAlarmLoop();
    stopLunchBackgroundKeepAlive();
    setShowAlarmModal(false);
    setLunchActive(false);
    setLunchTargetEpoch(null);
    clearMobileLunchNotification();
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_LUNCH);
  };

  // Active resolved visuals (supports live modal preview!)
  const activeThemeColor = visualPreview?.themeColor ?? themeColor;
  const activeCustomHex = visualPreview?.customAccentHex ?? customAccentHex;
  const activeIsDarkMode = visualPreview?.isDarkMode ?? isDarkMode;
  const activeBackgroundStyle = visualPreview?.backgroundStyle ?? backgroundStyle;
  const activeClockStyle = visualPreview?.clockStyle ?? clockStyle;
  const activeSurfaceStyle = visualPreview?.surfaceStyle ?? surfaceStyle;
  const activeRadiusStyle = visualPreview?.radiusStyle ?? radiusStyle;
  const activeBackdropSpeed = visualPreview?.backdropSpeed ?? backdropSpeed;
  const activeBackdropInteractive = visualPreview?.backdropInteractive ?? backdropInteractive;
  const activeMatrixEnabled = visualPreview?.matrixEnabled ?? matrixEnabled;
  const activeMatrixOpacity = visualPreview?.matrixOpacity ?? matrixOpacity;

  const currentVisualConfig: VisualThemeConfig = {
    themeColor: activeThemeColor,
    customAccentHex: activeCustomHex,
    isDarkMode: activeIsDarkMode,
    backgroundStyle: activeBackgroundStyle,
    clockStyle: activeClockStyle,
    surfaceStyle: activeSurfaceStyle,
    radiusStyle: activeRadiusStyle,
    backdropSpeed: activeBackdropSpeed,
    backdropInteractive: activeBackdropInteractive,
    matrixEnabled: activeMatrixEnabled,
    matrixOpacity: activeMatrixOpacity,
  };

  // Apply root tokens dynamically (including custom hex color tokens & surface/radius attributes)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', activeIsDarkMode);
    root.setAttribute('data-accent', activeThemeColor);
    root.setAttribute('data-surface', activeSurfaceStyle);
    root.setAttribute('data-radius', activeRadiusStyle);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', activeIsDarkMode ? '#07090d' : '#f1f4f9');
    }

    const customVarNames = [
      '--pf-accent',
      '--pf-accent-hover',
      '--pf-accent-fg',
      '--pf-accent-text',
      '--pf-accent-soft',
      '--pf-accent-border',
      '--pf-accent-glow',
    ];

    if (activeThemeColor === 'custom') {
      const tokens = computeCustomAccentTokens(activeCustomHex, activeIsDarkMode);
      root.style.setProperty('--pf-accent', tokens.accent);
      root.style.setProperty('--pf-accent-hover', tokens.accentHover);
      root.style.setProperty('--pf-accent-fg', tokens.accentFg);
      root.style.setProperty('--pf-accent-text', tokens.accentText);
      root.style.setProperty('--pf-accent-soft', tokens.accentSoft);
      root.style.setProperty('--pf-accent-border', tokens.accentBorder);
      root.style.setProperty('--pf-accent-glow', tokens.accentGlow);
    } else {
      customVarNames.forEach((v) => root.style.removeProperty(v));
    }
  }, [activeIsDarkMode, activeThemeColor, activeCustomHex, activeSurfaceStyle, activeRadiusStyle]);

  const VIBRANT_QUICK_COLORS = CURATED_THEME_PALETTES.filter((c) => c.group === 'vibrant');
  const DARK_QUICK_COLORS = CURATED_THEME_PALETTES.filter((c) => c.group === 'dark-light');

  const miniWidgetPayload = useMemo(
    () => buildWidgetPayload(todayPunches, workSchedule, currentDate, privacyMode),
    [todayPunches, workSchedule, currentDate, privacyMode]
  );

  return (
    <div className="min-h-screen pf-canvas flex flex-col font-sans relative transition-colors duration-200">
      {/* 8-Scene Interactive Pointer-Reactive Backdrop */}
      <MatrixBackground
        color={activeThemeColor}
        customAccentHex={activeCustomHex}
        enabled={activeMatrixEnabled}
        opacity={activeMatrixOpacity}
        isDarkMode={activeIsDarkMode}
        backgroundStyle={activeBackgroundStyle}
        speed={activeBackdropSpeed}
        interactiveMouse={activeBackdropInteractive}
      />

      {/* Sleek 3-Zone Top Bar */}
      <header className="border-b pf-border pf-surface sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Left: Clean Brand Wordmark */}
          <div className="flex flex-col justify-center shrink-0 leading-none">
            <div className="flex items-center gap-2">
              <div className="bg-slate-950 text-white dark:bg-white dark:text-slate-950 px-2 py-0.5 rounded font-black text-[11px] tracking-tighter uppercase border pf-border">
                GRUPO
              </div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight">
                pernambucanas
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.06em] uppercase pf-dev-credit-glow mt-1 whitespace-nowrap">
              DESENVOLVEDOR: MARCOS ROBERTO
            </span>
          </div>

          {/* Center: Single-Line Navigation Links (Desktop inline) */}
          <nav className="hidden md:flex items-center gap-1 pf-surface-muted p-1 pf-control-radius border pf-border">
            {(
              [
                { id: 'ponto', label: 'Registro de Ponto', icon: Fingerprint },
                { id: 'banco', label: 'Banco de Horas', icon: TrendingUp },
                { id: 'widget', label: 'Widget Celular', icon: Smartphone },
                { id: 'visual', label: 'Estúdio Visual', icon: Palette },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    isActive ? 'pf-btn-accent' : 'pf-text-muted hover:opacity-90'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Focused Studio Utilities + Primary INICIAR CTA */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallPrompt />

            {/* Privacy Mask Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !privacyMode;
                setPrivacyMode(next);
                persistConfigPatch({ privacyMode: next });
              }}
              aria-label={privacyMode ? 'Mostrar horários e CPF' : 'Ocultar horários e CPF (Privacidade)'}
              title={privacyMode ? 'Modo Privacidade Ativo (clique para revelar)' : 'Modo Privacidade (oculta CPF e horários)'}
              className={`p-2 pf-control-radius border transition cursor-pointer ${
                privacyMode ? 'pf-bg-accent-soft pf-border-accent pf-text-accent' : 'pf-surface-muted pf-border pf-text-muted'
              }`}
            >
              {privacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {/* Quick Palette Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQuickThemeMenu((v) => !v)}
                aria-label="Trocar cor do tema"
                title="Cor principal rápida"
                className="p-2 pf-control-radius pf-surface-muted border pf-border hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/20"
                  style={{ backgroundColor: 'var(--pf-accent)' }}
                />
              </button>

              {showQuickThemeMenu && (
                <div className="absolute right-0 mt-2 w-64 pf-surface-solid border pf-border pf-card-radius shadow-2xl p-3 z-50 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold pf-text-muted">
                    <span>Cor Rápida</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickThemeMenu(false);
                        setActiveTab('visual');
                      }}
                      className="pf-text-accent hover:underline cursor-pointer"
                    >
                      Abrir Estúdio
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider pf-text-muted mb-1">
                        Vibrantes
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {VIBRANT_QUICK_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              handleUpdateVisual({ themeColor: c.id });
                              setShowQuickThemeMenu(false);
                            }}
                            title={c.name}
                            className={`flex flex-col items-center p-1.5 rounded-lg border cursor-pointer transition ${
                              activeThemeColor === c.id
                                ? 'pf-surface-muted pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                                : 'pf-border hover:pf-surface-muted'
                            }`}
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-black/15"
                              style={{ backgroundColor: activeIsDarkMode ? c.darkHex : c.hex }}
                            />
                            <span className="text-[9px] font-semibold mt-1 truncate w-full text-center">
                              {c.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t pf-border">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider pf-text-muted mb-1">
                        <span>Escuras</span>
                        <span className="pf-text-accent normal-case font-semibold">Tema Claro</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {DARK_QUICK_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              handleUpdateVisual({ themeColor: c.id });
                              setShowQuickThemeMenu(false);
                            }}
                            title={`${c.name} (Ideal para Tema Claro)`}
                            className={`flex flex-col items-center p-1.5 rounded-lg border cursor-pointer transition ${
                              activeThemeColor === c.id
                                ? 'pf-surface-muted pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                                : 'pf-border hover:pf-surface-muted'
                            }`}
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-black/20 dark:border-white/25"
                              style={{ backgroundColor: c.hex }}
                            />
                            <span className="text-[9px] font-semibold mt-1 truncate w-full text-center">
                              {c.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Light / Dark Quick Toggle */}
            <button
              type="button"
              onClick={() => handleUpdateVisual({ isDarkMode: !activeIsDarkMode })}
              aria-label={activeIsDarkMode ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
              title={activeIsDarkMode ? 'Tema Claro' : 'Tema Escuro'}
              className="p-2 pf-control-radius pf-surface-muted border pf-border hover:opacity-90 transition cursor-pointer"
            >
              {activeIsDarkMode ? (
                <Sun className="w-4 h-4 pf-text-accent" />
              ) : (
                <Moon className="w-4 h-4 pf-text-accent" />
              )}
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={() => {
                setShowQuickThemeMenu(false);
                setShowSettingsModal(true);
              }}
              aria-label="Abrir configurações do aplicativo"
              title="Configurações Gerais (Credenciais, Alarme, Escala e Notificações)"
              className="p-2 pf-text-muted hover:pf-text-accent pf-control-radius pf-surface-muted border pf-border transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Primary INICIAR CTA in Header */}
            {isConfigured && (
              <button
                type="button"
                onClick={() => handleInitiatePunch('real')}
                disabled={isPunching}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 pf-btn-accent pf-control-radius font-extrabold text-xs cursor-pointer transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>INICIAR</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile 4-Tab Grid Bar (All 4 tabs visible without clipping on 390px) */}
        <div className="md:hidden border-t pf-border px-2.5 py-2 grid grid-cols-4 gap-1.5">
          {(
            [
              { id: 'ponto', label: 'Ponto', icon: Fingerprint },
              { id: 'banco', label: 'Banco', icon: TrendingUp },
              { id: 'widget', label: 'Widget', icon: Smartphone },
              { id: 'visual', label: 'Visual', icon: Palette },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 pf-control-radius text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                  isActive ? 'pf-btn-accent' : 'pf-surface-muted pf-text-muted'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 flex flex-col items-center justify-start space-y-5 relative z-10">
        {appToast && (
          <div className="pf-no-print w-full max-w-6xl pf-bg-accent-soft border pf-border-accent pf-control-radius px-4 py-2.5 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 pf-text-accent shrink-0" />
            <span>{appToast}</span>
          </div>
        )}

        {/* TAB 1: REGISTRO DE PONTO (BENTO WORKSPACE) */}
        {activeTab === 'ponto' && (
          <div className="w-full flex flex-col items-center space-y-5">
            {/* Compact Status Header Strip */}
            <div className="w-full max-w-6xl pf-surface border pf-control-radius px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-extrabold">Portal Nossa Gente</span>
                <span className="pf-text-muted">·</span>
                <span className="pf-text-secondary">
                  {isConfigured
                    ? `Conectado: ${maskCredentialDisplay(usuario, privacyMode)}`
                    : 'Credenciais não configuradas'}
                </span>
                <span className="pf-text-muted hidden sm:inline">·</span>
                <button
                  type="button"
                  onClick={() =>
                    notificationPermission === 'default'
                      ? handleEnableMobileNotifications()
                      : setShowSettingsModal(true)
                  }
                  className="hidden sm:inline pf-text-muted hover:pf-text-accent transition cursor-pointer"
                >
                  Notificações:{' '}
                  <strong className={notificationPermission === 'granted' ? 'text-emerald-600 dark:text-emerald-400' : 'pf-text-accent'}>
                    {notificationPermission === 'granted'
                      ? 'Ativas'
                      : notificationPermission === 'denied'
                        ? 'Bloqueadas'
                        : 'Ativar'}
                  </strong>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!isConfigured && (
                  <button
                    type="button"
                    onClick={() => setShowFirstSetupModal(true)}
                    className="px-3 py-1.5 pf-btn-accent font-bold pf-control-radius text-xs cursor-pointer"
                  >
                    Configurar Login
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('widget')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 pf-surface-muted border pf-border pf-control-radius text-[11px] font-bold hover:opacity-90 cursor-pointer"
                >
                  <Pin className="w-3 h-3 pf-text-accent" />
                  <span>{widgetPinned ? 'Widget Ativo' : 'Widget Celular'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenFloatingMiniWidget}
                  title="Abrir Widget Flutuante (PiP / Mini-Card)"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 pf-surface-muted border pf-border pf-control-radius text-[11px] font-bold hover:opacity-90 cursor-pointer"
                >
                  <PictureInPicture2 className="w-3 h-3 pf-text-accent" />
                  <span className="hidden sm:inline">Flutuante</span>
                </button>

                <a
                  href={PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 pf-surface-muted border pf-border pf-control-radius text-[11px] font-semibold hover:opacity-90"
                >
                  <ExternalLink className="w-3 h-3 pf-text-accent" />
                  <span className="hidden sm:inline">Portal</span>
                </a>
              </div>
            </div>

            {isPunching && (
              <div className="w-full max-w-6xl pf-bg-accent-soft border pf-border-accent-solid pf-control-radius p-4 flex items-center gap-3">
                <RotateCw className="w-5 h-5 pf-text-accent animate-spin shrink-0" />
                <div className="flex-1">
                  <h5 className="text-xs font-bold pf-text-accent uppercase tracking-wider">
                    Registrando Ponto...
                  </h5>
                  <p className="text-xs pf-text-secondary mt-0.5">{punchProgressMessage}</p>
                </div>
              </div>
            )}

            {punchError && (
              <div className="w-full max-w-6xl bg-red-500/10 border border-red-500/40 pf-control-radius p-4 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <h5 className="font-bold text-red-700 dark:text-red-300 mb-1">Falha na Automação</h5>
                  <p className="pf-text-secondary leading-relaxed">{punchError}</p>
                </div>
              </div>
            )}

            {/* Bento 2-Column Workspace Card */}
            <PunchHistoryCard
              currentTime={currentTime}
              currentDateStr={currentDateStr}
              currentDate={currentDate}
              punches={todayPunches}
              totalHistoryCount={punches.length}
              incompleteDays={incompleteDays}
              privacyMode={privacyMode}
              schedule={workSchedule}
              clockStyle={activeClockStyle}
              onViewBancoDeHoras={() => setActiveTab('banco')}
              isPunching={isPunching}
              humanMode={humanMode}
              autoVisibility={autoVisibility}
              onToggleHumanMode={() => handleChangeExecutionOption(!humanMode, autoVisibility)}
              onChangeExecutionOption={handleChangeExecutionOption}
              onInitiatePunch={() => handleInitiatePunch('real')}
              onSimulatePunch={() => handleInitiatePunch('simulado')}
              onQuickManualPunch={() => handleConfirmPunchFromX(new Date(), { isSimulated: false })}
              onDeletePunch={handleDeletePunch}
              onTestPortalConnection={() => handleTestPortalConnection()}
              onTestHumanPortal={() => handleTestPortalConnection({ forceHuman: true })}
              onVerifyPunchesToday={handleVerifyPunchesToday}
              isVerifyingPunches={isVerifyingPunches}
            />

            {/* Compact Automation Guide */}
            <div className="w-full max-w-6xl pf-surface border pf-control-radius p-4 pf-text-muted text-xs flex items-start gap-3">
              <HelpCircle className="w-4 h-4 pf-text-accent shrink-0 mt-0.5" />
              <p className="text-[11px] sm:text-xs leading-relaxed">
                <strong className="pf-text-secondary">Fluxo oficial:</strong> Ao clicar em <strong>Marcar ponto</strong>, o sistema acessa <code className="pf-text-accent">pernambucanas.lgcloud.com.br</code>, trata eventuais avisos de login em 5s e executa em <strong>Auto · Ao Vivo</strong>, <strong>Auto · 2º Plano</strong> ou <strong>Manual (✕)</strong>. Em seguida, ativa o contador de almoço e sincroniza o widget no celular.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: PAINEL DE BANCO DE HORAS */}
        {activeTab === 'banco' && (
          <div className="w-full flex flex-col items-center">
            <BancoDeHorasPanel
              punches={punches}
              schedule={workSchedule}
              baseline={bancoBaseline}
              onUpdateSchedule={handleUpdateSchedule}
              onUpdateBaseline={handleUpdateBancoBaseline}
              onAddManualPunch={handleAddManualPunch}
              onDeletePunch={handleDeletePunch}
              onClearSimulated={handleClearSimulated}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              themeColor={activeThemeColor}
              isDarkMode={activeIsDarkMode}
            />
          </div>
        )}

        {/* TAB 3: WIDGET NO CELULAR */}
        {activeTab === 'widget' && (
          <div className="w-full flex flex-col items-center">
            <MobileWidgetStudio
              todayPunches={todayPunches}
              schedule={workSchedule}
              currentDate={currentDate}
              privacyMode={privacyMode}
              widgetPinned={widgetPinned}
              notificationPermission={notificationPermission}
              onTogglePinWidget={handleTogglePinWidget}
              onForceSyncWidget={handleForceSyncWidget}
              onOpenFloatingMiniWidget={handleOpenFloatingMiniWidget}
              onInitiatePunch={() => handleInitiatePunch('real')}
            />
          </div>
        )}

        {/* TAB 4: ESTÚDIO VISUAL INTERATIVO */}
        {activeTab === 'visual' && (
          <div className="w-full flex flex-col items-center">
            <VisualStudioPanel
              visual={currentVisualConfig}
              onUpdateVisual={handleUpdateVisual}
              onOpenGeneralSettings={() => setShowSettingsModal(true)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t pf-border pf-surface py-3.5 text-center text-[11px] pf-text-muted relative z-10">
        <p>LG lugar de gente · Portal Nossa Gente · Pernambucanas SAAA · PontoFácil Studio v3.0</p>
      </footer>

      {/* In-App Floating Mini-Widget Fallback */}
      {showFloatingMiniWidget && (
        <div className="fixed bottom-4 right-4 z-40 w-72 pf-surface-solid border pf-border-accent-solid pf-card-radius shadow-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider pf-text-accent">
              Mini-Widget · Hoje ({miniWidgetPayload.punchCount})
            </span>
            <button
              type="button"
              onClick={() => setShowFloatingMiniWidget(false)}
              className="pf-text-muted hover:opacity-80 cursor-pointer"
              aria-label="Fechar mini-widget"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black tabular-nums pf-text-accent">
              {privacyMode ? '••:••:••' : currentTime}
            </span>
            <span className="font-mono text-xs pf-text-muted tabular-nums">
              {miniWidgetPayload.workedText}
            </span>
          </div>
          <div className="text-[11px] font-mono pf-surface-muted pf-control-radius border pf-border px-2.5 py-2 leading-snug">
            {miniWidgetPayload.punchListText}
          </div>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[10px] pf-text-muted truncate">
              Próx: <strong>{miniWidgetPayload.nextPunchLabel}</strong>
            </span>
            <button
              type="button"
              onClick={() => handleInitiatePunch('real')}
              className="px-3 py-1.5 pf-btn-accent pf-control-radius text-[11px] font-extrabold cursor-pointer shrink-0"
            >
              Bater Agora
            </button>
          </div>
        </div>
      )}

      {/* Persistent Lunch Notification */}
      {lunchActive && (
        <PersistentLunchNotification
          remainingSeconds={remainingSeconds}
          totalDurationSeconds={lunchDurationMinutes * 60}
          startTimeStr={lunchStartTimeStr}
          expectedEndTimeStr={expectedEndTimeStr}
          notificationStatus={notificationPermission}
          onEnableNotifications={handleEnableMobileNotifications}
          onCancel={handleCancelLunch}
          onFastForwardDemo={handleFastForwardDemo}
        />
      )}

      {/* Modals (100% automation preserved) */}
      <LunchPromptModal
        isOpen={showLunchPrompt}
        registeredTime={lastPunchTime}
        durationMinutes={lunchDurationMinutes}
        onConfirmLunch={handleConfirmLunch}
        onDismiss={handleDismissLunch}
      />

      <AlarmReturnModal
        isOpen={showAlarmModal}
        onInitiatePunchAgain={handleInitiatePunchFromAlarm}
        onDismissAlarm={handleDismissAlarmOnly}
      />

      <CredentialsModal
        isOpen={showFirstSetupModal}
        onClose={() => setShowFirstSetupModal(false)}
        onSave={handleSaveCredentials}
        initialUsuario={usuario}
        initialSenha={senha}
        isFirstSetup={true}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => {
          setVisualPreview(null);
          setShowSettingsModal(false);
        }}
        onCancel={() => {
          setVisualPreview(null);
          setShowSettingsModal(false);
        }}
        usuario={usuario}
        senha={senha}
        lunchDurationMinutes={lunchDurationMinutes}
        useSimulation={useSimulation}
        humanMode={humanMode}
        autoVisibility={autoVisibility}
        themeColor={themeColor}
        customAccentHex={customAccentHex}
        isDarkMode={isDarkMode}
        backgroundStyle={backgroundStyle}
        clockStyle={clockStyle}
        surfaceStyle={surfaceStyle}
        radiusStyle={radiusStyle}
        backdropSpeed={backdropSpeed}
        backdropInteractive={backdropInteractive}
        matrixEnabled={matrixEnabled}
        matrixOpacity={matrixOpacity}
        alarmSoundId={alarmSoundId}
        workSchedule={workSchedule}
        onPreviewVisuals={setVisualPreview}
        onSaveSettings={handleSaveSettings}
        onClearHistory={handleClearHistory}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onNotificationStatusChange={(status) => setNotificationPermission(status)}
      />

      <TestResultModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        isLoading={isTestingPortal}
        progressMessage={punchProgressMessage}
        result={portalTestResult}
        onRunRealPunch={() => handleInitiatePunch('real')}
        currentUsuario={usuario}
        currentSenha={senha}
        onUpdateCredentialsAndRetry={handleUpdateCredentialsAndRetry}
        onTestHumanMode={() => handleTestPortalConnection({ forceHuman: true })}
      />

      <PortalInteractiveModal
        isOpen={showPortalInteractive}
        usuario={usuario}
        senha={senha}
        mode={portalFlowMode}
        autoVisibility={autoVisibility}
        onChangeMode={(nextMode) => setPortalFlowMode(nextMode)}
        onChangeAutoVisibility={(nextVis) => handleChangeExecutionOption(humanMode, nextVis)}
        onConfirmPunchFromX={handleConfirmPunchFromX}
        onSyncPunchesFromPortal={handleSyncPunchesFromPortal}
        onCloseWithoutSaving={() => setShowPortalInteractive(false)}
      />
    </div>
  );
}
