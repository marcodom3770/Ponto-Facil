import React from 'react';
import {
  Palette,
  Sun,
  Moon,
  Sparkles,
  Clock,
  Layers,
  MousePointerClick,
  Gauge,
  Sliders,
  Check,
  Terminal,
  Grid3X3,
  CircleDot,
  Waves,
  Hexagon,
  Orbit,
  Star,
} from 'lucide-react';
import {
  BackdropSpeed,
  BackgroundStyle,
  CURATED_THEME_PALETTES,
  ClockStyle,
  RadiusStyle,
  SurfaceStyle,
  ThemeColor,
  VisualThemeConfig,
} from '../utils/punch-rules';

interface VisualStudioPanelProps {
  visual: VisualThemeConfig;
  onUpdateVisual: (patch: Partial<VisualThemeConfig>) => void;
  onOpenGeneralSettings: () => void;
}

const PRESET_THEMES: Array<{
  id: string;
  name: string;
  desc: string;
  swatch: string;
  config: Partial<VisualThemeConfig>;
}> = [
  {
    id: 'pernambucanas',
    name: 'Pernambucanas Studio',
    desc: 'Ouro vibrante, vidro escuro e constelação reativa',
    swatch: '#facc15',
    config: {
      themeColor: 'yellow',
      isDarkMode: true,
      backgroundStyle: 'constellation',
      surfaceStyle: 'glass',
      radiusStyle: 'balanced',
      clockStyle: 'digital',
      matrixEnabled: true,
      matrixOpacity: 0.24,
      backdropSpeed: 'normal',
      backdropInteractive: true,
    },
  },
  {
    id: 'esmeralda',
    name: 'Esmeralda Cyber',
    desc: 'Verde matrix clássico com LED digital e bordas retas',
    swatch: '#10b981',
    config: {
      themeColor: 'green',
      isDarkMode: true,
      backgroundStyle: 'matrix',
      surfaceStyle: 'glass',
      radiusStyle: 'sharp',
      clockStyle: 'segmented',
      matrixEnabled: true,
      matrixOpacity: 0.22,
      backdropSpeed: 'normal',
      backdropInteractive: true,
    },
  },
  {
    id: 'safira-dia',
    name: 'Safira Executivo (Claro)',
    desc: 'Tema claro luminoso com ondas suaves e relógio analógico',
    swatch: '#0284c7',
    config: {
      themeColor: 'blue',
      isDarkMode: false,
      backgroundStyle: 'waves',
      surfaceStyle: 'solid',
      radiusStyle: 'balanced',
      clockStyle: 'analog',
      matrixEnabled: true,
      matrixOpacity: 0.20,
      backdropSpeed: 'slow',
      backdropInteractive: true,
    },
  },
  {
    id: 'aurora-neon',
    name: 'Aurora Boreal Roxo',
    desc: 'Brilho atmosférico profundo com hexágonos luminosos',
    swatch: '#a855f7',
    config: {
      themeColor: 'purple',
      isDarkMode: true,
      backgroundStyle: 'hexgrid',
      surfaceStyle: 'glass',
      radiusStyle: 'soft',
      clockStyle: 'progress',
      matrixEnabled: true,
      matrixOpacity: 0.24,
      backdropSpeed: 'normal',
      backdropInteractive: true,
    },
  },
  {
    id: 'obsidiana-carmesim',
    name: 'Viagem Estelar Carmesim',
    desc: 'Campo estelar 3D em alta nitidez e linhas minimalistas',
    swatch: '#ef4444',
    config: {
      themeColor: 'red',
      isDarkMode: true,
      backgroundStyle: 'starfield',
      surfaceStyle: 'outline',
      radiusStyle: 'balanced',
      clockStyle: 'minimal',
      matrixEnabled: true,
      matrixOpacity: 0.26,
      backdropSpeed: 'normal',
      backdropInteractive: true,
    },
  },
  {
    id: 'claro-minimal',
    name: 'Papel Limpo (Claro)',
    desc: 'Sem animações de fundo para máxima legibilidade diurna',
    swatch: '#0d9488',
    config: {
      themeColor: 'teal',
      isDarkMode: false,
      backgroundStyle: 'minimal',
      surfaceStyle: 'solid',
      radiusStyle: 'balanced',
      clockStyle: 'digital',
      matrixEnabled: false,
      matrixOpacity: 0.14,
      backdropInteractive: false,
    },
  },
  {
    id: 'executivo-onyx',
    name: 'Executivo Ônix (Claro)',
    desc: 'Tema claro com alto contraste preto ônix e grade precisa',
    swatch: '#0f172a',
    config: {
      themeColor: 'onyx',
      isDarkMode: false,
      backgroundStyle: 'grid',
      surfaceStyle: 'solid',
      radiusStyle: 'sharp',
      clockStyle: 'digital',
      matrixEnabled: true,
      matrixOpacity: 0.16,
      backdropSpeed: 'normal',
      backdropInteractive: true,
    },
  },
  {
    id: 'marinho-corp',
    name: 'Marinho Corporativo (Claro)',
    desc: 'Azul marinho profundo com vidro claro e meta da jornada',
    swatch: '#1e3a8a',
    config: {
      themeColor: 'navy',
      isDarkMode: false,
      backgroundStyle: 'constellation',
      surfaceStyle: 'glass',
      radiusStyle: 'balanced',
      clockStyle: 'progress',
      matrixEnabled: true,
      matrixOpacity: 0.18,
      backdropSpeed: 'slow',
      backdropInteractive: true,
    },
  },
];

const VIBRANT_PALETTES = CURATED_THEME_PALETTES.filter((p) => p.group === 'vibrant');
const DARK_LIGHT_PALETTES = CURATED_THEME_PALETTES.filter((p) => p.group === 'dark-light');

const BACKGROUNDS: Array<{
  id: BackgroundStyle;
  name: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  { id: 'constellation', name: 'Constelação', desc: 'Nós conectados ao cursor', icon: <Orbit className="w-4 h-4 pf-text-accent" /> },
  { id: 'waves', name: 'Ondas Fluídas', desc: 'Topografia ondulante viva', icon: <Waves className="w-4 h-4 pf-text-accent" /> },
  { id: 'hexgrid', name: 'Grade Hexagonal', desc: 'Células iluminam no toque', icon: <Hexagon className="w-4 h-4 pf-text-accent" /> },
  { id: 'starfield', name: 'Campo Estelar 3D', desc: 'Profundidade com paralaxe', icon: <Star className="w-4 h-4 pf-text-accent" /> },
  { id: 'matrix', name: 'Chuva Matrix', desc: 'Cascata digital clássica', icon: <Terminal className="w-4 h-4 pf-text-accent" /> },
  { id: 'grid', name: 'Grade Precisão', desc: 'Malha arquitetônica fina', icon: <Grid3X3 className="w-4 h-4 pf-text-accent" /> },
  { id: 'aurora', name: 'Aurora Suave', desc: 'Gradiente orgânico fluido', icon: <Sparkles className="w-4 h-4 pf-text-accent" /> },
  { id: 'minimal', name: 'Estúdio Limpo', desc: 'Foco absoluto sem fundo', icon: <CircleDot className="w-4 h-4 pf-text-accent" /> },
];

const CLOCKS: Array<{ id: ClockStyle; name: string; desc: string }> = [
  { id: 'digital', name: 'Digital Impacto', desc: 'Tipografia tabular ampla' },
  { id: 'segmented', name: 'Display LED', desc: 'Blocos individuais HH:MM:SS' },
  { id: 'analog', name: 'Analógico Precisão', desc: 'Mostrador SVG com ponteiros' },
  { id: 'progress', name: 'Com Meta Diária', desc: 'Relógio + barra da jornada' },
  { id: 'minimal', name: 'Editorial Leve', desc: 'Minimalista sofisticado' },
];

export const VisualStudioPanel: React.FC<VisualStudioPanelProps> = ({
  visual,
  onUpdateVisual,
  onOpenGeneralSettings,
}) => {
  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Studio Intro Header */}
      <div className="pf-surface border pf-card-radius p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider pf-text-accent">
            <Palette className="w-4 h-4" />
            <span>Estúdio Visual ao Vivo</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
            Personalize Cada Detalhe da Interface
          </h2>
          <p className="text-xs sm:text-sm pf-text-muted mt-1">
            Todas as alterações são aplicadas e salvas em tempo real no tema claro/escuro, fundos interativos, relógio e superfícies.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center pf-surface-muted p-1 pf-control-radius border pf-border">
            <button
              type="button"
              onClick={() => onUpdateVisual({ isDarkMode: true })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                visual.isDarkMode ? 'pf-btn-accent' : 'pf-text-muted'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Escuro</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateVisual({ isDarkMode: false })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                !visual.isDarkMode ? 'pf-btn-accent' : 'pf-text-muted'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Claro</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenGeneralSettings}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 pf-control-radius pf-surface-muted border pf-border text-xs font-bold hover:opacity-90 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 pf-text-accent" />
            <span className="hidden sm:inline">Credenciais &amp; Som</span>
          </button>
        </div>
      </div>

      {/* 1. Curated 1-Click Theme Presets */}
      <div className="pf-surface border pf-card-radius p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 pf-text-accent" />
            <span>Combinações Prontas (1 Clique)</span>
          </h3>
          <span className="text-[11px] pf-text-muted">Aplica paleta + fundo + superfície + relógio</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_THEMES.map((preset) => {
            const isActive =
              visual.themeColor === preset.config.themeColor &&
              visual.isDarkMode === preset.config.isDarkMode &&
              visual.backgroundStyle === preset.config.backgroundStyle &&
              visual.clockStyle === preset.config.clockStyle;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onUpdateVisual(preset.config)}
                className={`p-3.5 pf-control-radius border text-left transition cursor-pointer flex items-start gap-3 ${
                  isActive
                    ? 'pf-surface-muted pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                    : 'pf-surface-muted pf-border hover:opacity-90'
                }`}
              >
                <span
                  className="w-8 h-8 rounded-lg shrink-0 border border-black/20 dark:border-white/20 shadow-sm flex items-center justify-center"
                  style={{ backgroundColor: preset.swatch }}
                >
                  {isActive && (
                    <Check
                      className={`w-4 h-4 ${
                        preset.config.themeColor === 'onyx' || preset.config.themeColor === 'navy'
                          ? 'text-white'
                          : 'text-black'
                      }`}
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">{preset.name}</div>
                  <p className="text-[11px] pf-text-muted leading-snug mt-0.5">{preset.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Colors & Surface Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Palette + Custom Hex Picker */}
        <div className="lg:col-span-7 pf-surface border pf-card-radius p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Cor Principal &amp; Seletor Livre</h3>
            <span className="text-[11px] font-mono pf-text-accent font-bold">
              {visual.themeColor === 'custom' ? visual.customAccentHex.toUpperCase() : visual.themeColor}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider pf-text-muted mb-2">
                Cores Vibrantes
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VIBRANT_PALETTES.map((p) => {
                  const selected = visual.themeColor === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onUpdateVisual({ themeColor: p.id })}
                      className={`flex items-center gap-2.5 px-3 py-2.5 pf-control-radius border text-left transition cursor-pointer ${
                        selected
                          ? 'pf-surface-muted pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                          : 'pf-surface-muted pf-border hover:opacity-90'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full shrink-0 border border-black/15"
                        style={{ backgroundColor: visual.isDarkMode ? p.darkHex : p.hex }}
                      />
                      <span className="text-xs font-bold">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t pf-border">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider pf-text-muted">
                  Cores Escuras
                </span>
                <span className="text-[10px] font-semibold pf-text-accent">
                  Ideais para Tema Claro
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DARK_LIGHT_PALETTES.map((p) => {
                  const selected = visual.themeColor === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onUpdateVisual({ themeColor: p.id })}
                      className={`flex items-center gap-2.5 px-3 py-2.5 pf-control-radius border text-left transition cursor-pointer ${
                        selected
                          ? 'pf-surface-muted pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                          : 'pf-surface-muted pf-border hover:opacity-90'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full shrink-0 border border-black/20 dark:border-white/25"
                        style={{ backgroundColor: p.hex }}
                      />
                      <span className="text-xs font-bold">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Custom Color Wheel / Hex Input */}
          <div className="pt-3 border-t pf-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold">Cor Personalizada Livre</div>
              <div className="text-[11px] pf-text-muted">
                Calcula contraste WCAG automaticamente para Claro &amp; Escuro
              </div>
            </div>
            <label className="inline-flex items-center gap-2.5 px-3 py-1.5 pf-surface-muted pf-control-radius border pf-border cursor-pointer">
              <input
                type="color"
                aria-label="Escolher cor personalizada"
                value={visual.customAccentHex}
                onChange={(e) =>
                  onUpdateVisual({ themeColor: 'custom', customAccentHex: e.target.value })
                }
                className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono font-bold uppercase">
                {visual.customAccentHex}
              </span>
            </label>
          </div>
        </div>

        {/* Surface Material & Corner Geometry */}
        <div className="lg:col-span-5 pf-surface border pf-card-radius p-5 sm:p-6 space-y-5">
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 pf-text-accent" />
              <span>Acabamento dos Cartões</span>
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'glass', label: 'Vidro Glass', desc: 'Translúcido' },
                  { id: 'solid', label: 'Estúdio Sólido', desc: 'Opaco nítido' },
                  { id: 'outline', label: 'Minimal Fino', desc: 'Leve & aéreo' },
                ] as Array<{ id: SurfaceStyle; label: string; desc: string }>
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onUpdateVisual({ surfaceStyle: s.id })}
                  className={`p-2.5 pf-control-radius border text-left transition cursor-pointer ${
                    visual.surfaceStyle === s.id
                      ? 'pf-surface-muted pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                      : 'pf-surface-muted pf-border opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="text-xs font-bold">{s.label}</div>
                  <div className="text-[10px] pf-text-muted">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 pt-3 border-t pf-border">
            <h3 className="text-xs font-bold uppercase tracking-wider pf-text-muted">
              Geometria das Bordas
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'sharp', label: 'Retas (8px)' },
                  { id: 'balanced', label: 'Equilibradas' },
                  { id: 'soft', label: 'Arredondadas' },
                ] as Array<{ id: RadiusStyle; label: string }>
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onUpdateVisual({ radiusStyle: r.id })}
                  className={`py-2 px-2 pf-control-radius border text-xs font-bold transition cursor-pointer ${
                    visual.radiusStyle === r.id
                      ? 'pf-btn-accent border-transparent'
                      : 'pf-surface-muted pf-border'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Background Scenes (8 Modes + Speed + Pointer Reactivity) */}
      <div className="pf-surface border pf-card-radius p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">8 Telas de Fundo Interativas</h3>
            <p className="text-[11px] pf-text-muted">
              Mova o mouse ou toque na tela para interagir com partículas, ondas e grades luminosas
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateVisual({ backdropInteractive: !visual.backdropInteractive })
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 pf-control-radius border text-xs font-bold transition cursor-pointer ${
              visual.backdropInteractive
                ? 'pf-bg-accent-soft pf-border-accent pf-text-accent'
                : 'pf-surface-muted pf-border pf-text-muted'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>
              Reagir ao Mouse/Toque: {visual.backdropInteractive ? 'Ativo' : 'Desligado'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {BACKGROUNDS.map((bg) => {
            const active =
              bg.id === 'minimal'
                ? !visual.matrixEnabled || visual.backgroundStyle === 'minimal'
                : visual.matrixEnabled && visual.backgroundStyle === bg.id;
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() =>
                  onUpdateVisual({
                    backgroundStyle: bg.id,
                    matrixEnabled: bg.id !== 'minimal',
                  })
                }
                className={`p-3 pf-control-radius border text-left transition cursor-pointer ${
                  active
                    ? 'pf-surface-muted pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                    : 'pf-surface-muted pf-border hover:opacity-90'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold">
                  {bg.icon}
                  <span>{bg.name}</span>
                </div>
                <p className="text-[10px] pf-text-muted mt-1">{bg.desc}</p>
              </button>
            );
          })}
        </div>

        {visual.matrixEnabled && visual.backgroundStyle !== 'minimal' && (
          <div className="pt-3 border-t pf-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 pf-text-accent" />
              <span className="text-xs font-bold">Velocidade:</span>
              <div className="flex items-center gap-1 pf-surface-muted p-1 pf-control-radius border pf-border">
                {(
                  [
                    { id: 'slow', label: 'Suave' },
                    { id: 'normal', label: 'Normal' },
                    { id: 'fast', label: 'Dinâmica' },
                  ] as Array<{ id: BackdropSpeed; label: string }>
                ).map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => onUpdateVisual({ backdropSpeed: sp.id })}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                      visual.backdropSpeed === sp.id ? 'pf-btn-accent' : 'pf-text-muted'
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="pf-text-muted font-semibold">Intensidade:</span>
              <input
                type="range"
                min="0.08"
                max="0.48"
                step="0.02"
                value={visual.matrixOpacity}
                onChange={(e) => onUpdateVisual({ matrixOpacity: Number(e.target.value) })}
                className="w-36 pf-accent-range cursor-pointer"
              />
              <span className="font-mono font-bold tabular-nums w-10 text-right">
                {Math.round(visual.matrixOpacity * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Clock Styles */}
      <div className="pf-surface border pf-card-radius p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 pf-text-accent" />
          <h3 className="text-sm font-bold">5 Mostradores de Relógio</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {CLOCKS.map((cs) => (
            <button
              key={cs.id}
              type="button"
              onClick={() => onUpdateVisual({ clockStyle: cs.id })}
              className={`p-3 pf-control-radius border text-left transition cursor-pointer ${
                visual.clockStyle === cs.id
                  ? 'pf-surface-muted pf-border-accent-solid ring-1 ring-[var(--pf-accent)]'
                  : 'pf-surface-muted pf-border hover:opacity-90'
              }`}
            >
              <div className="text-xs font-bold">{cs.name}</div>
              <div className="text-[10px] pf-text-muted mt-0.5">{cs.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
