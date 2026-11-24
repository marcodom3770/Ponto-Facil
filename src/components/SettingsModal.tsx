import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  KeyRound,
  Eye,
  EyeOff,
  Volume2,
  Bell,
  Code2,
  Check,
  Copy,
  Trash2,
  Clock,
  Smartphone,
  Palette,
  Sun,
  Moon,
  Play,
  Terminal,
  Calendar,
  UserCheck,
  Zap,
  Sparkles,
  Grid3X3,
  CircleDot,
  Hand,
  Download,
  Upload,
  Scale,
  FileJson,
} from 'lucide-react';
import {
  ThemeColor,
  CURATED_THEME_PALETTES,
  BackgroundStyle,
  ClockStyle,
  SurfaceStyle,
  RadiusStyle,
  BackdropSpeed,
  AutoVisibility,
  AlarmSoundId,
  WorkScheduleConfig,
  BackupImportMode,
} from '../utils/punch-rules';
import {
  playSoundPreset,
  ALARM_SOUND_PRESETS,
  setAlarmSound,
  unlockAudioEngine,
} from '../utils/sound-alarm';
import {
  getMobileNotificationStatus,
  requestMobileNotificationPermission,
  sendMobileTestNotification,
  MobileNotificationStatus,
} from '../utils/service-worker-client';

export interface VisualPreviewPayload {
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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  usuario: string;
  senha: string;
  lunchDurationMinutes: number;
  useSimulation: boolean;
  themeColor: ThemeColor;
  customAccentHex?: string;
  isDarkMode: boolean;
  backgroundStyle?: BackgroundStyle;
  clockStyle?: ClockStyle;
  surfaceStyle?: SurfaceStyle;
  radiusStyle?: RadiusStyle;
  backdropSpeed?: BackdropSpeed;
  backdropInteractive?: boolean;
  matrixEnabled: boolean;
  matrixOpacity: number;
  alarmSoundId: AlarmSoundId;
  workSchedule: WorkScheduleConfig;
  humanMode?: boolean;
  autoVisibility?: AutoVisibility;
  onPreviewVisuals?: (preview: VisualPreviewPayload) => void;
  onSaveSettings: (settings: {
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
  }) => void;
  onClearHistory: () => void;
  onExportBackup?: () => void;
  onImportBackup?: (file: File, mode?: BackupImportMode) => void;
  onNotificationStatusChange?: (status: MobileNotificationStatus) => void;
}

const VIBRANT_COLORS = CURATED_THEME_PALETTES.filter((c) => c.group === 'vibrant');
const DARK_LIGHT_COLORS = CURATED_THEME_PALETTES.filter((c) => c.group === 'dark-light');

const BACKGROUND_STYLES: { id: BackgroundStyle; name: string; desc: string }[] = [
  { id: 'constellation', name: 'Constelação', desc: 'Nós ligados ao cursor' },
  { id: 'waves', name: 'Ondas Fluídas', desc: 'Ondas topográficas' },
  { id: 'hexgrid', name: 'Hexagonal', desc: 'Células luminosas' },
  { id: 'starfield', name: 'Estelar 3D', desc: 'Paralaxe espacial' },
  { id: 'matrix', name: 'Chuva Matrix', desc: 'Cascata digital' },
  { id: 'grid', name: 'Grade Técnica', desc: 'Malha geométrica' },
  { id: 'aurora', name: 'Aurora Suave', desc: 'Brilho atmosférico' },
  { id: 'minimal', name: 'Minimalista', desc: 'Fundo limpo focado' },
];

const CLOCK_STYLES: { id: ClockStyle; name: string; desc: string }[] = [
  { id: 'digital', name: 'Digital Clássico', desc: 'Grande com destaque' },
  { id: 'segmented', name: 'Display LED', desc: 'Blocos separados' },
  { id: 'analog', name: 'Analógico', desc: 'Mostrador ponteiros' },
  { id: 'minimal', name: 'Minimalista', desc: 'Tipografia leve' },
  { id: 'progress', name: 'Com Progresso', desc: 'Barra de meta diária' },
];

const WEEK_DAYS = [
  { day: 0, label: 'Dom' },
  { day: 1, label: 'Seg' },
  { day: 2, label: 'Ter' },
  { day: 3, label: 'Qua' },
  { day: 4, label: 'Qui' },
  { day: 5, label: 'Sex' },
  { day: 6, label: 'Sáb' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  usuario,
  senha,
  lunchDurationMinutes,
  useSimulation,
  themeColor,
  customAccentHex = '#facc15',
  isDarkMode,
  backgroundStyle = 'constellation',
  clockStyle = 'digital',
  surfaceStyle = 'glass',
  radiusStyle = 'balanced',
  backdropSpeed = 'normal',
  backdropInteractive = true,
  matrixEnabled,
  matrixOpacity,
  alarmSoundId,
  workSchedule,
  humanMode = true,
  autoVisibility = 'visible',
  onPreviewVisuals,
  onSaveSettings,
  onClearHistory,
  onExportBackup,
  onImportBackup,
  onNotificationStatusChange,
}) => {
  const [localUsuario, setLocalUsuario] = useState(usuario);
  const [localSenha, setLocalSenha] = useState(senha);
  const [showPassword, setShowPassword] = useState(false);
  const [localDuration, setLocalDuration] = useState(lunchDurationMinutes);
  const [localSim, setLocalSim] = useState(useSimulation);
  const [localHumanMode, setLocalHumanMode] = useState(humanMode);
  const [localAutoVisibility, setLocalAutoVisibility] = useState<AutoVisibility>(autoVisibility);
  const [localThemeColor, setLocalThemeColor] = useState<ThemeColor>(themeColor);
  const [localCustomHex, setLocalCustomHex] = useState(customAccentHex);
  const [localIsDark, setLocalIsDark] = useState(isDarkMode);
  const [localBgStyle, setLocalBgStyle] = useState<BackgroundStyle>(backgroundStyle);
  const [localClockStyle, setLocalClockStyle] = useState<ClockStyle>(clockStyle);
  const [localSurfaceStyle, setLocalSurfaceStyle] = useState<SurfaceStyle>(surfaceStyle);
  const [localRadiusStyle, setLocalRadiusStyle] = useState<RadiusStyle>(radiusStyle);
  const [localBackdropSpeed, setLocalBackdropSpeed] = useState<BackdropSpeed>(backdropSpeed);
  const [localBackdropInteractive, setLocalBackdropInteractive] = useState(backdropInteractive);
  const [localMatrixEnabled, setLocalMatrixEnabled] = useState(matrixEnabled);
  const [localMatrixOpacity, setLocalMatrixOpacity] = useState(matrixOpacity);
  const [localAlarmSound, setLocalAlarmSound] = useState<AlarmSoundId>(alarmSoundId);
  const [localSchedule, setLocalSchedule] = useState<WorkScheduleConfig>(workSchedule);
  const [isCopied, setIsCopied] = useState(false);
  const [playingPreset, setPlayingPreset] = useState<AlarmSoundId | null>(null);
  const [importMode, setImportMode] = useState<BackupImportMode>('merge');
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  const [notificationStatus, setNotificationStatus] = useState<MobileNotificationStatus>(() =>
    getMobileNotificationStatus()
  );
  const [notificationFeedback, setNotificationFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setLocalUsuario(usuario);
      setLocalSenha(senha);
      setLocalDuration(lunchDurationMinutes);
      setLocalSim(useSimulation);
      setLocalHumanMode(humanMode);
      setLocalAutoVisibility(autoVisibility);
      setLocalThemeColor(themeColor);
      setLocalCustomHex(customAccentHex);
      setLocalIsDark(isDarkMode);
      setLocalBgStyle(backgroundStyle);
      setLocalClockStyle(clockStyle);
      setLocalSurfaceStyle(surfaceStyle);
      setLocalRadiusStyle(radiusStyle);
      setLocalBackdropSpeed(backdropSpeed);
      setLocalBackdropInteractive(backdropInteractive);
      setLocalMatrixEnabled(matrixEnabled);
      setLocalMatrixOpacity(matrixOpacity);
      setLocalAlarmSound(alarmSoundId);
      setLocalSchedule(workSchedule);
      const currentPerm = getMobileNotificationStatus();
      setNotificationStatus(currentPerm);
      setNotificationFeedback(null);
      onNotificationStatusChange?.(currentPerm);
    }
    wasOpenRef.current = isOpen;
  }, [
    isOpen,
    usuario,
    senha,
    lunchDurationMinutes,
    useSimulation,
    humanMode,
    autoVisibility,
    themeColor,
    customAccentHex,
    isDarkMode,
    backgroundStyle,
    clockStyle,
    surfaceStyle,
    radiusStyle,
    backdropSpeed,
    backdropInteractive,
    matrixEnabled,
    matrixOpacity,
    alarmSoundId,
    workSchedule,
    onNotificationStatusChange,
  ]);

  if (!isOpen) return null;

  const emitVisualPreview = (patch: Partial<VisualPreviewPayload>) => {
    if (!onPreviewVisuals) return;
    onPreviewVisuals({
      themeColor: patch.themeColor ?? localThemeColor,
      customAccentHex: patch.customAccentHex ?? localCustomHex,
      isDarkMode: patch.isDarkMode ?? localIsDark,
      backgroundStyle: patch.backgroundStyle ?? localBgStyle,
      clockStyle: patch.clockStyle ?? localClockStyle,
      surfaceStyle: patch.surfaceStyle ?? localSurfaceStyle,
      radiusStyle: patch.radiusStyle ?? localRadiusStyle,
      backdropSpeed: patch.backdropSpeed ?? localBackdropSpeed,
      backdropInteractive: patch.backdropInteractive ?? localBackdropInteractive,
      matrixEnabled: patch.matrixEnabled ?? localMatrixEnabled,
      matrixOpacity: patch.matrixOpacity ?? localMatrixOpacity,
    });
  };

  const handleCloseCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  const handleTestSound = (soundId: AlarmSoundId) => {
    unlockAudioEngine();
    setPlayingPreset(soundId);
    playSoundPreset(soundId);
    setTimeout(() => setPlayingPreset(null), 1200);
  };

  const toggleScheduleDay = (day: number) => {
    const days = localSchedule.workDays.includes(day)
      ? localSchedule.workDays.filter((d) => d !== day)
      : [...localSchedule.workDays, day].sort();
    setLocalSchedule({ ...localSchedule, workDays: days });
  };

  const handleRequestNotification = async () => {
    setIsRequestingNotif(true);
    setNotificationFeedback(null);
    unlockAudioEngine();
    try {
      const permission = await requestMobileNotificationPermission();
      setNotificationStatus(permission);
      onNotificationStatusChange?.(permission);

      if (permission === 'granted') {
        const res = await sendMobileTestNotification();
        if (res.ok) {
          setNotificationFeedback({
            type: 'success',
            text: 'Permissão concedida! Notificação de teste enviada para a barra do seu celular.',
          });
        } else {
          setNotificationFeedback({
            type: 'info',
            text: res.error || 'Permissão concedida. O Service Worker foi ativado.',
          });
        }
      } else if (permission === 'denied') {
        setNotificationFeedback({
          type: 'error',
          text: 'Bloqueado no navegador. Toque no ícone de cadeado/ajustes ao lado do endereço do site > Permissões > Notificações > Permitir.',
        });
      } else {
        setNotificationFeedback({
          type: 'info',
          text: 'Permissão ainda não aceita. Toque em "Permitir" quando o navegador perguntar.',
        });
      }
    } finally {
      setIsRequestingNotif(false);
    }
  };

  const handleTestBarAndSound = async () => {
    unlockAudioEngine();
    playSoundPreset(localAlarmSound);
    const res = await sendMobileTestNotification();
    setNotificationStatus(res.permission);
    onNotificationStatusChange?.(res.permission);
    if (res.ok) {
      setNotificationFeedback({
        type: 'success',
        text: 'Teste enviado para a barra de notificações do celular com o toque selecionado!',
      });
    } else {
      setNotificationFeedback({
        type: res.permission === 'denied' ? 'error' : 'info',
        text: res.error || 'Ative a permissão de notificações primeiro.',
      });
    }
  };

  const bookmarkletCode = `javascript:(function(){const user="${encodeURIComponent(
    localUsuario
  )}";const pass="${encodeURIComponent(
    localSenha
  )}";const u=document.querySelector('#ContentPlaceHolder_txtLoginT');const p=document.querySelector('#ContentPlaceHolder_txtSenhaT');const b=document.querySelector('#ContentPlaceHolder_btnEntrar');if(u&&p&&b){u.value=decodeURIComponent(user);p.value=decodeURIComponent(pass);b.click();}else{const pontoBtn=document.querySelector('button[aria-label="Marcar ponto"]')||document.querySelector('#app button');if(pontoBtn){pontoBtn.click();alert('Ponto registrado! Inicie o timer de almoço no PontoFácil.');}else{alert('Abra a página de login ou dashboard da Pernambucanas!');}}})();`;

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAlarmSound(localAlarmSound);
    onSaveSettings({
      usuario: localUsuario.trim(),
      senha: localSenha,
      lunchDurationMinutes: Number(localDuration) || 60,
      useSimulation: localSim,
      themeColor: localThemeColor,
      customAccentHex: localCustomHex,
      isDarkMode: localIsDark,
      backgroundStyle: localBgStyle,
      clockStyle: localClockStyle,
      surfaceStyle: localSurfaceStyle,
      radiusStyle: localRadiusStyle,
      backdropSpeed: localBackdropSpeed,
      backdropInteractive: localBackdropInteractive,
      matrixEnabled: localMatrixEnabled,
      matrixOpacity: localMatrixOpacity,
      alarmSoundId: localAlarmSound,
      workSchedule: localSchedule,
      humanMode: localHumanMode,
      autoVisibility: localAutoVisibility,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl pf-surface border pf-border rounded-3xl shadow-2xl p-6 my-8 max-h-[90vh] overflow-y-auto transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b pf-border mb-5 sticky top-0 pf-surface z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 pf-bg-accent rounded-xl shadow-sm">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Configurações Gerais do App</h2>
              <p className="text-xs pf-text-muted">
                Visual ao Vivo, Automação, Notificações, Escala e Credenciais
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseCancel}
            className="pf-text-muted hover:opacity-80 text-xs font-semibold px-3 py-1.5 rounded-lg pf-surface-muted border pf-border cursor-pointer"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* THEMES & VISUAL CUSTOMIZATION */}
          <div className="pf-surface-muted p-4 sm:p-5 rounded-2xl border pf-border space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 pf-text-accent text-xs font-bold uppercase tracking-wider">
                <Palette className="w-4 h-4" />
                <span>Personalização Visual (Pré-visualização Instantânea)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md pf-bg-accent-soft pf-text-accent font-mono font-bold">
                100% Tematizado
              </span>
            </div>

            {/* Light / Dark Mode Toggle */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold block">Modo de Exibição</span>
                <span className="text-[11px] pf-text-muted">Aplica em fundos, cartões, modais e textos</span>
              </div>
              <div className="flex items-center pf-surface p-1 rounded-xl border pf-border">
                <button
                  type="button"
                  onClick={() => {
                    setLocalIsDark(true);
                    emitVisualPreview({ isDarkMode: true });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    localIsDark ? 'pf-btn-accent' : 'pf-text-muted'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Escuro</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalIsDark(false);
                    emitVisualPreview({ isDarkMode: false });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    !localIsDark ? 'pf-btn-accent' : 'pf-text-muted'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Claro</span>
                </button>
              </div>
            </div>

            {/* 16 Color Palette Selector (Vibrantes + Escuras p/ Tema Claro) */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs pf-text-secondary mb-2 font-bold">
                  Cores Vibrantes
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VIBRANT_COLORS.map((c) => {
                    const isSelected = localThemeColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setLocalThemeColor(c.id);
                          emitVisualPreview({ themeColor: c.id });
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'pf-surface pf-border-accent-solid ring-2 ring-[var(--pf-accent)] shadow-sm'
                            : 'pf-surface pf-border hover:opacity-90'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full shrink-0 shadow-sm border border-black/15"
                          style={{ backgroundColor: localIsDark ? c.darkHex : c.hex }}
                        />
                        <span className="text-xs font-bold whitespace-nowrap">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs pf-text-secondary font-bold">
                    Cores Escuras
                  </label>
                  <span className="text-[11px] font-semibold pf-text-accent">
                    Ideais para Tema Claro
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DARK_LIGHT_COLORS.map((c) => {
                    const isSelected = localThemeColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setLocalThemeColor(c.id);
                          emitVisualPreview({ themeColor: c.id });
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'pf-surface pf-border-accent-solid ring-2 ring-[var(--pf-accent)] shadow-sm'
                            : 'pf-surface pf-border hover:opacity-90'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full shrink-0 shadow-sm border border-black/20 dark:border-white/25"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-xs font-bold whitespace-nowrap">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4 Background Styles */}
            <div className="pt-2 border-t pf-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 pf-text-accent" />
                    <span>Estilo do Plano de Fundo Animado</span>
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={localMatrixEnabled}
                  onClick={() => {
                    const next = !localMatrixEnabled;
                    setLocalMatrixEnabled(next);
                    emitVisualPreview({ matrixEnabled: next });
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    localMatrixEnabled ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      localMatrixEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BACKGROUND_STYLES.map((bg) => {
                  const active = localBgStyle === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => {
                        setLocalBgStyle(bg.id);
                        setLocalMatrixEnabled(bg.id !== 'minimal');
                        emitVisualPreview({
                          backgroundStyle: bg.id,
                          matrixEnabled: bg.id !== 'minimal',
                        });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? 'pf-surface pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                          : 'pf-surface pf-border hover:opacity-90'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {bg.id === 'matrix' && <Terminal className="w-3.5 h-3.5 pf-text-accent" />}
                        {bg.id === 'grid' && <Grid3X3 className="w-3.5 h-3.5 pf-text-accent" />}
                        {bg.id === 'aurora' && <Sparkles className="w-3.5 h-3.5 pf-text-accent" />}
                        {bg.id === 'minimal' && <CircleDot className="w-3.5 h-3.5 pf-text-accent" />}
                        <span>{bg.name}</span>
                      </div>
                      <p className="text-[10px] pf-text-muted mt-0.5">{bg.desc}</p>
                    </button>
                  );
                })}
              </div>

              {localMatrixEnabled && localBgStyle !== 'minimal' && (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="pf-text-muted font-medium">Intensidade do fundo:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.06"
                      max="0.45"
                      step="0.03"
                      value={localMatrixOpacity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalMatrixOpacity(val);
                        emitVisualPreview({ matrixOpacity: val });
                      }}
                      className="w-32 pf-accent-range cursor-pointer"
                    />
                    <span className="font-mono text-[11px] font-bold w-10 text-right">
                      {Math.round(localMatrixOpacity * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 5 Clock Styles */}
            <div className="pt-2 border-t pf-border space-y-2">
              <label className="block text-xs font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 pf-text-accent" />
                <span>Estilo do Relógio Principal</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CLOCK_STYLES.map((cs) => {
                  const active = localClockStyle === cs.id;
                  return (
                    <button
                      key={cs.id}
                      type="button"
                      onClick={() => {
                        setLocalClockStyle(cs.id);
                        emitVisualPreview({ clockStyle: cs.id });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? 'pf-surface pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                          : 'pf-surface pf-border hover:opacity-90'
                      }`}
                    >
                      <div className="text-xs font-bold">{cs.name}</div>
                      <p className="text-[10px] pf-text-muted mt-0.5">{cs.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* MODO AUTOMÁTICO (AO VIVO vs 2º PLANO) OU MANUAL */}
          <div className="pf-surface-muted p-4 rounded-2xl border pf-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 pf-text-accent text-xs font-bold uppercase tracking-wider">
                <UserCheck className="w-4 h-4" />
                <span>Execução da Automação no Portal</span>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-md font-mono font-bold pf-bg-accent-soft pf-text-accent border pf-border-accent">
                {!localHumanMode
                  ? 'Manual (✕)'
                  : localAutoVisibility === 'background'
                    ? 'Automático • 2º Plano'
                    : 'Automático • Ao Vivo'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLocalHumanMode(true);
                  setLocalAutoVisibility('visible');
                }}
                className={`p-3 rounded-xl border transition text-left cursor-pointer flex flex-col justify-between ${
                  localHumanMode && localAutoVisibility === 'visible'
                    ? 'pf-surface pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                    : 'pf-surface pf-border opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-4 h-4 pf-text-accent" />
                  <span className="text-xs font-bold">Auto • Ao Vivo</span>
                </div>
                <p className="text-[11px] pf-text-muted leading-relaxed">
                  Você vê a tela do portal abrindo, digitando CPF/senha, clicando em "Marcar ponto" e confirmando em "Sim".
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLocalHumanMode(true);
                  setLocalAutoVisibility('background');
                }}
                className={`p-3 rounded-xl border transition text-left cursor-pointer flex flex-col justify-between ${
                  localHumanMode && localAutoVisibility === 'background'
                    ? 'pf-surface pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                    : 'pf-surface pf-border opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <EyeOff className="w-4 h-4 pf-text-accent" />
                  <span className="text-xs font-bold">Auto • 2º Plano</span>
                </div>
                <p className="text-[11px] pf-text-muted leading-relaxed">
                  Executa exatamente o mesmo fluxo sem mostrar a tela do portal (exibe apenas barra de status discreta).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLocalHumanMode(false)}
                className={`p-3 rounded-xl border transition text-left cursor-pointer flex flex-col justify-between ${
                  !localHumanMode
                    ? 'pf-surface pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                    : 'pf-surface pf-border opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Hand className="w-4 h-4 pf-text-accent" />
                  <span className="text-xs font-bold">Manual com (✕)</span>
                </div>
                <p className="text-[11px] pf-text-muted leading-relaxed">
                  Faz login automático e abre o Autoatendimento para você bater o ponto e tocar no (✕).
                </p>
              </button>
            </div>
          </div>

          {/* MOBILE NOTIFICATIONS & BACKGROUND ALARM SECTION */}
          <div className="pf-surface-muted p-4 rounded-2xl border pf-border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 pf-text-accent text-xs font-bold uppercase tracking-wider">
                <Smartphone className="w-4 h-4" />
                <span>Notificações no Celular &amp; Tela Bloqueada</span>
              </div>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                  notificationStatus === 'granted'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : notificationStatus === 'denied'
                      ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}
              >
                {notificationStatus === 'granted'
                  ? 'Ativadas na Barra'
                  : notificationStatus === 'denied'
                    ? 'Bloqueadas no Navegador'
                    : notificationStatus === 'default'
                      ? 'Aguardando Ativação'
                      : 'Não Suportado'}
              </span>
            </div>

            <p className="text-[11px] pf-text-secondary leading-relaxed">
              Ative para exibir o <strong>contador do almoço na barra de notificações do celular</strong> e disparar alerta sonoro/vibração ao final da 1 hora, mesmo com a tela bloqueada.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleRequestNotification}
                disabled={isRequestingNotif || notificationStatus === 'unsupported'}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer pf-btn-accent"
              >
                <Bell className="w-4 h-4" />
                <span>
                  {notificationStatus === 'granted'
                    ? 'Notificações Ativadas (Enviar Teste)'
                    : 'Ativar Notificações no Celular'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleTestBarAndSound}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold pf-surface border pf-border hover:opacity-90 transition cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 pf-text-accent" />
                <span>Testar Barra + Som</span>
              </button>
            </div>

            {notificationFeedback && (
              <div
                className={`text-[11px] px-3 py-2 rounded-xl border ${
                  notificationFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : notificationFeedback.type === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}
              >
                {notificationFeedback.text}
              </div>
            )}
          </div>

          {/* NOTIFICATION SOUND SELECTION */}
          <div className="pf-surface-muted p-4 rounded-2xl border pf-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 pf-text-accent text-xs font-bold uppercase tracking-wider">
                <Volume2 className="w-4 h-4" />
                <span>Música / Som do Alarme de Almoço</span>
              </div>
              <span className="text-[11px] pf-text-muted">Clique para ouvir</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ALARM_SOUND_PRESETS.map((preset) => {
                const isSelected = localAlarmSound === preset.id;
                const isPlaying = playingPreset === preset.id;

                return (
                  <div
                    key={preset.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition ${
                      isSelected
                        ? 'pf-surface pf-border-accent-solid shadow-sm'
                        : 'pf-surface pf-border opacity-85 hover:opacity-100'
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <input
                        type="radio"
                        name="alarmSound"
                        value={preset.id}
                        checked={isSelected}
                        onChange={() => {
                          setLocalAlarmSound(preset.id);
                          handleTestSound(preset.id);
                        }}
                        style={{ accentColor: 'var(--pf-accent)' }}
                      />
                      <div>
                        <div className="text-xs font-bold">{preset.name}</div>
                        <div className="text-[10px] pf-text-muted leading-tight">
                          {preset.description}
                        </div>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleTestSound(preset.id)}
                      title={`Tocar prévia: ${preset.name}`}
                      className="p-1.5 ml-2 rounded-lg pf-surface-muted pf-text-accent border pf-border transition cursor-pointer"
                    >
                      <Play className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BANCO DE HORAS & WORK DAYS SCHEDULE */}
          <div className="pf-surface-muted p-4 rounded-2xl border pf-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 pf-text-accent text-xs font-bold uppercase tracking-wider">
                <Calendar className="w-4 h-4" />
                <span>Dias de Trabalho &amp; Escala</span>
              </div>
              <span className="text-[11px] pf-text-accent font-mono font-bold">
                Folga = 100% Extra
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {WEEK_DAYS.map(({ day, label }) => {
                const isSelected = localSchedule.workDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleScheduleDay(day)}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'pf-btn-accent border-transparent'
                        : 'pf-surface pf-text-muted pf-border'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs pf-text-secondary mb-1 font-semibold">Entrada Regular</label>
                <input
                  type="time"
                  value={localSchedule.workStart}
                  onChange={(e) =>
                    setLocalSchedule({ ...localSchedule, workStart: e.target.value })
                  }
                  className="w-full px-3 py-1.5 pf-surface border pf-border rounded-lg font-mono text-xs pf-ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs pf-text-secondary mb-1 font-semibold">Saída Regular</label>
                <input
                  type="time"
                  value={localSchedule.workEnd}
                  onChange={(e) => setLocalSchedule({ ...localSchedule, workEnd: e.target.value })}
                  className="w-full px-3 py-1.5 pf-surface border pf-border rounded-lg font-mono text-xs pf-ring-accent"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 pf-surface border pf-border rounded-xl cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={Boolean(localSchedule.cltToleranceEnabled)}
                onChange={(e) =>
                  setLocalSchedule({ ...localSchedule, cltToleranceEnabled: e.target.checked })
                }
                className="mt-0.5 w-4 h-4 rounded"
                style={{ accentColor: 'var(--pf-accent)' }}
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Scale className="w-3.5 h-3.5 pf-text-accent" />
                  <span>Tolerância CLT (Art. 58 § 1º — ±10 min diários)</span>
                </div>
                <p className="text-[11px] pf-text-muted leading-snug">
                  Quando ativado, variações diárias de até ±10 minutos no saldo total do dia são zeradas automaticamente, seguindo o padrão legal da CLT.
                </p>
              </div>
            </label>
          </div>

          {/* CREDENTIALS SECTION */}
          <div className="pf-surface-muted p-4 rounded-2xl border pf-border space-y-3">
            <div className="flex items-center gap-2 pf-text-accent text-xs font-bold uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              <span>Credenciais Salvas (Portal Pernambucanas)</span>
            </div>

            <div>
              <label className="block text-xs pf-text-secondary mb-1 font-semibold">
                Login / CPF (<code className="pf-text-accent">#ContentPlaceHolder_txtLoginT</code>)
              </label>
              <input
                type="text"
                value={localUsuario}
                onChange={(e) => setLocalUsuario(e.target.value)}
                placeholder="Login"
                className="w-full px-3.5 py-2 pf-surface border pf-border rounded-lg text-sm pf-ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs pf-text-secondary mb-1 font-semibold">
                Senha (<code className="pf-text-accent">#ContentPlaceHolder_txtSenhaT</code>)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={localSenha}
                  onChange={(e) => setLocalSenha(e.target.value)}
                  placeholder="Senha"
                  className="w-full px-3.5 pr-10 py-2 pf-surface border pf-border rounded-lg text-sm pf-ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center pf-text-muted hover:opacity-80 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Lunch Interval Duration */}
          <div className="pf-surface-muted p-4 rounded-2xl border pf-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 pf-text-accent text-xs font-bold uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                <span>Duração do Intervalo de Almoço</span>
              </div>
              <span className="text-xs font-mono font-bold pf-text-accent pf-bg-accent-soft px-2 py-0.5 rounded border pf-border-accent">
                {localDuration === 60 ? '1 hora (60 min)' : `${localDuration} min`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLocalDuration(60)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  localDuration === 60 ? 'pf-btn-accent border-transparent' : 'pf-surface pf-border'
                }`}
              >
                1 hora (60 min)
              </button>
              <button
                type="button"
                onClick={() => setLocalDuration(59)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  localDuration === 59 ? 'pf-btn-accent border-transparent' : 'pf-surface pf-border'
                }`}
              >
                59 min
              </button>
              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={localDuration}
                  onChange={(e) => setLocalDuration(Number(e.target.value))}
                  className="w-16 px-2 py-1 pf-surface border pf-border rounded-lg text-xs font-mono text-center pf-ring-accent"
                />
                <span className="text-xs pf-text-muted">min</span>
              </div>
            </div>
          </div>

          {/* Bookmarklet Helper */}
          <div className="pf-surface-muted p-4 rounded-2xl border pf-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold pf-text-secondary flex items-center gap-1.5">
                <Code2 className="w-4 h-4 pf-text-accent" />
                Script / Bookmarklet de 1-Clique
              </span>
              <button
                type="button"
                onClick={handleCopyBookmarklet}
                className="inline-flex items-center gap-1 text-[11px] font-semibold pf-text-accent px-2 py-0.5 rounded pf-bg-accent-soft border pf-border-accent cursor-pointer"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? 'Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>
            <div className="mt-2 pf-surface p-2 rounded border pf-border font-mono text-[10px] pf-text-muted truncate select-all">
              {bookmarkletCode}
            </div>
          </div>

          {/* EXPORTAR & IMPORTAR .JSON (TRANSFERIR ENTRE DISPOSITIVOS) */}
          {(onExportBackup || onImportBackup) && (
            <div className="pf-surface-muted p-4 rounded-2xl border pf-border-accent space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 pf-text-accent text-xs font-bold uppercase tracking-wider">
                  <FileJson className="w-4 h-4" />
                  <span>Exportar &amp; Importar .json (Outro Dispositivo)</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full pf-bg-accent-soft pf-text-accent border pf-border-accent">
                  Portabilidade Total
                </span>
              </div>

              <p className="text-[11px] pf-text-muted leading-relaxed">
                Salve todas as suas batidas, escala, medição do banco de horas, notificações e tema visual em um arquivo <code className="pf-text-accent font-bold">.json</code> para restaurar facilmente em outro celular ou navegador.
              </p>

              {onImportBackup && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 pf-surface rounded-xl border pf-border">
                  <span className="text-[11px] font-semibold pf-text-secondary">
                    Modo ao importar arquivo .json:
                  </span>
                  <div className="inline-flex p-1 pf-surface-muted rounded-lg border pf-border gap-1">
                    <button
                      type="button"
                      onClick={() => setImportMode('merge')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        importMode === 'merge' ? 'pf-btn-accent' : 'pf-text-muted'
                      }`}
                    >
                      Mesclar sem duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        importMode === 'replace' ? 'pf-btn-accent' : 'pf-text-muted'
                      }`}
                    >
                      Substituir tudo
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                {onExportBackup && (
                  <button
                    type="button"
                    onClick={onExportBackup}
                    className="inline-flex items-center gap-2 px-4 py-2.5 pf-btn-accent rounded-xl text-xs font-extrabold transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar .json</span>
                  </button>
                )}

                {onImportBackup && (
                  <>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onImportBackup(file, importMode);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => backupFileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 pf-surface border pf-border hover:pf-border-accent rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4 pf-text-accent" />
                      <span>Importar .json</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t pf-border">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onClearHistory}
                className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar histórico</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseCancel}
                className="px-4 py-2 text-xs font-semibold pf-text-muted hover:opacity-80 rounded-lg pf-surface-muted border pf-border transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 pf-btn-accent font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Salvar Todas as Configurações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
