import React, { useEffect, useRef } from 'react';
import {
  BackdropSpeed,
  BackgroundStyle,
  ThemeColor,
  computeCustomAccentTokens,
} from '../utils/punch-rules';

interface MatrixBackgroundProps {
  color: ThemeColor;
  customAccentHex?: string;
  enabled?: boolean;
  opacity?: number;
  isDarkMode?: boolean;
  backgroundStyle?: BackgroundStyle;
  speed?: BackdropSpeed;
  interactiveMouse?: boolean;
}

const COLOR_MAP: Record<
  Exclude<ThemeColor, 'custom'>,
  {
    darkHead: string;
    darkTrail: string;
    lightHead: string;
    lightTrail: string;
    lightRgb: string;
    darkRgb: string;
  }
> = {
  yellow: {
    darkHead: '#fef08a',
    darkTrail: '#eab308',
    lightHead: '#a16207',
    lightTrail: '#d97706',
    lightRgb: '217, 119, 6',
    darkRgb: '250, 204, 21',
  },
  green: {
    darkHead: '#bbf7d0',
    darkTrail: '#10b981',
    lightHead: '#047857',
    lightTrail: '#059669',
    lightRgb: '5, 150, 105',
    darkRgb: '16, 185, 129',
  },
  red: {
    darkHead: '#fecaca',
    darkTrail: '#ef4444',
    lightHead: '#b91c1c',
    lightTrail: '#dc2626',
    lightRgb: '220, 38, 38',
    darkRgb: '239, 68, 68',
  },
  blue: {
    darkHead: '#bae6fd',
    darkTrail: '#38bdf8',
    lightHead: '#0369a1',
    lightTrail: '#0284c7',
    lightRgb: '2, 132, 199',
    darkRgb: '56, 189, 248',
  },
  purple: {
    darkHead: '#f5d0fe',
    darkTrail: '#a855f7',
    lightHead: '#6d28d9',
    lightTrail: '#7c3aed',
    lightRgb: '124, 58, 237',
    darkRgb: '168, 85, 247',
  },
  orange: {
    darkHead: '#fed7aa',
    darkTrail: '#fb923c',
    lightHead: '#c2410c',
    lightTrail: '#ea580c',
    lightRgb: '234, 88, 12',
    darkRgb: '251, 146, 60',
  },
  teal: {
    darkHead: '#99f6e4',
    darkTrail: '#2dd4bf',
    lightHead: '#0f766e',
    lightTrail: '#0d9488',
    lightRgb: '13, 148, 136',
    darkRgb: '45, 212, 191',
  },
  pink: {
    darkHead: '#fbcfe8',
    darkTrail: '#f472b6',
    lightHead: '#be185d',
    lightTrail: '#db2777',
    lightRgb: '219, 39, 119',
    darkRgb: '244, 114, 182',
  },
  onyx: {
    darkHead: '#f8fafc',
    darkTrail: '#cbd5e1',
    lightHead: '#020617',
    lightTrail: '#0f172a',
    lightRgb: '15, 23, 42',
    darkRgb: '226, 232, 240',
  },
  graphite: {
    darkHead: '#e2e8f0',
    darkTrail: '#94a3b8',
    lightHead: '#1e293b',
    lightTrail: '#334155',
    lightRgb: '51, 65, 85',
    darkRgb: '148, 163, 184',
  },
  navy: {
    darkHead: '#bfdbfe',
    darkTrail: '#60a5fa',
    lightHead: '#172554',
    lightTrail: '#1e3a8a',
    lightRgb: '30, 58, 138',
    darkRgb: '96, 165, 250',
  },
  forest: {
    darkHead: '#bbf7d0',
    darkTrail: '#4ade80',
    lightHead: '#052e16',
    lightTrail: '#14532d',
    lightRgb: '20, 83, 45',
    darkRgb: '74, 222, 128',
  },
  wine: {
    darkHead: '#fecdd3',
    darkTrail: '#fb7185',
    lightHead: '#4c0519',
    lightTrail: '#881337',
    lightRgb: '136, 19, 55',
    darkRgb: '251, 113, 133',
  },
  indigo: {
    darkHead: '#c7d2fe',
    darkTrail: '#818cf8',
    lightHead: '#1e1b4b',
    lightTrail: '#312e81',
    lightRgb: '49, 46, 129',
    darkRgb: '129, 140, 248',
  },
  espresso: {
    darkHead: '#fde68a',
    darkTrail: '#f59e0b',
    lightHead: '#290f02',
    lightTrail: '#451a03',
    lightRgb: '69, 26, 3',
    darkRgb: '245, 158, 11',
  },
  petrol: {
    darkHead: '#99f6e4',
    darkTrail: '#2dd4bf',
    lightHead: '#042f2e',
    lightTrail: '#115e59',
    lightRgb: '17, 94, 89',
    darkRgb: '45, 212, 191',
  },
};

export const MatrixBackground: React.FC<MatrixBackgroundProps> = ({
  color,
  customAccentHex = '#eab308',
  enabled = true,
  opacity = 0.22,
  isDarkMode = true,
  backgroundStyle = 'constellation',
  speed = 'normal',
  interactiveMouse = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });

  const colors =
    color === 'custom'
      ? (() => {
          const tok = computeCustomAccentTokens(customAccentHex, isDarkMode);
          return {
            darkHead: '#ffffff',
            darkTrail: tok.accent,
            lightHead: tok.accentText,
            lightTrail: tok.accent,
            rgb: tok.rgb,
          };
        })()
      : (() => {
          const entry = COLOR_MAP[color] || COLOR_MAP.yellow;
          return {
            darkHead: entry.darkHead,
            darkTrail: entry.darkTrail,
            lightHead: entry.lightHead,
            lightTrail: entry.lightTrail,
            rgb: isDarkMode ? entry.darkRgb : entry.lightRgb,
          };
        })();

  const effectiveStyle: BackgroundStyle = !enabled ? 'minimal' : backgroundStyle;
  const speedMultiplier = speed === 'slow' ? 0.55 : speed === 'fast' ? 1.75 : 1.0;

  // Shared pointer tracker for all interactive backdrops
  useEffect(() => {
    if (!interactiveMouse || effectiveStyle === 'minimal') {
      pointerRef.current = { x: -1000, y: -1000, active: false };
      return;
    }

    const handleMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handleLeave = () => {
      pointerRef.current.active = false;
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerdown', handleMove, { passive: true });
    window.addEventListener('pointerleave', handleLeave);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerdown', handleMove);
      window.removeEventListener('pointerleave', handleLeave);
    };
  }, [interactiveMouse, effectiveStyle]);

  // Canvas-rendered scenes: matrix | constellation | waves | hexgrid | starfield
  useEffect(() => {
    const isCanvasScene =
      effectiveStyle === 'matrix' ||
      effectiveStyle === 'constellation' ||
      effectiveStyle === 'waves' ||
      effectiveStyle === 'hexgrid' ||
      effectiveStyle === 'starfield';

    if (!isCanvasScene) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initScene();
    };

    // Scene state variables
    const fontSize = 14;
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#@$%&*+-=PNT';
    let drops: number[] = [];
    let nodes: Array<{ x: number; y: number; vx: number; vy: number; r: number }> = [];
    let stars: Array<{ x: number; y: number; z: number }> = [];
    let phase = 0;

    function initScene() {
      if (effectiveStyle === 'matrix') {
        const cols = Math.max(1, Math.floor(width / fontSize));
        drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -40));
      } else if (effectiveStyle === 'constellation') {
        const count = Math.min(85, Math.max(28, Math.floor((width * height) / 18000)));
        nodes = Array.from({ length: count }, () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.65 * speedMultiplier,
          vy: (Math.random() - 0.5) * 0.65 * speedMultiplier,
          r: 1.5 + Math.random() * 1.6,
        }));
      } else if (effectiveStyle === 'starfield') {
        const starCount = Math.min(180, Math.max(70, Math.floor((width * height) / 10000)));
        stars = Array.from({ length: starCount }, () => ({
          x: (Math.random() - 0.5) * width * 1.4,
          y: (Math.random() - 0.5) * height * 1.4,
          z: Math.random() * width,
        }));
      }
    }

    initScene();
    window.addEventListener('resize', handleResize);
    ctx.clearRect(0, 0, width, height);

    let lastTime = 0;
    const fpsInterval = effectiveStyle === 'matrix' ? 1000 / (28 * speedMultiplier) : 1000 / 32;

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const elapsed = now - lastTime;
      if (elapsed < fpsInterval) return;
      lastTime = now - (elapsed % fpsInterval);
      phase += 0.022 * speedMultiplier;

      const ptr = pointerRef.current;

      if (effectiveStyle === 'matrix') {
        ctx.fillStyle = isDarkMode ? 'rgba(7, 9, 13, 0.16)' : 'rgba(241, 244, 249, 0.25)';
        ctx.fillRect(0, 0, width, height);
        ctx.font = `${fontSize}px monospace`;
        const headColor = isDarkMode ? colors.darkHead : colors.lightHead;
        const trailColor = isDarkMode ? colors.darkTrail : colors.lightTrail;

        for (let i = 0; i < drops.length; i++) {
          const text = chars.charAt(Math.floor(Math.random() * chars.length));
          const x = i * fontSize;
          const y = drops[i] * fontSize;

          const nearMouse =
            interactiveMouse &&
            ptr.active &&
            Math.hypot(x - ptr.x, y - ptr.y) < 130;

          ctx.fillStyle = nearMouse ? '#ffffff' : headColor;
          ctx.fillText(text, x, y);

          ctx.fillStyle = trailColor;
          ctx.fillText(text, x, y - fontSize);

          if (y > height && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      } else if (effectiveStyle === 'constellation') {
        ctx.clearRect(0, 0, width, height);
        const linkDist = 145;

        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;

          // Subtle cursor attraction / energy
          if (interactiveMouse && ptr.active) {
            const dx = ptr.x - n.x;
            const dy = ptr.y - n.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 170 && dist > 18) {
              n.x += (dx / dist) * 0.45 * speedMultiplier;
              n.y += (dy / dist) * 0.45 * speedMultiplier;
            }
          }
        }

        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (dist < linkDist) {
              const alpha = (1 - dist / linkDist) * (isDarkMode ? 0.55 : 0.42);
              ctx.strokeStyle = `rgba(${colors.rgb}, ${alpha.toFixed(3)})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }

          if (interactiveMouse && ptr.active) {
            const pDist = Math.hypot(a.x - ptr.x, a.y - ptr.y);
            if (pDist < 190) {
              const alpha = (1 - pDist / 190) * 0.78;
              ctx.strokeStyle = `rgba(${colors.rgb}, ${alpha.toFixed(3)})`;
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(ptr.x, ptr.y);
              ctx.stroke();
            }
          }

          ctx.fillStyle = `rgba(${colors.rgb}, ${isDarkMode ? 0.85 : 0.75})`;
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effectiveStyle === 'waves') {
        ctx.clearRect(0, 0, width, height);
        const lines = 9;
        for (let l = 0; l < lines; l++) {
          const baseY = height * (0.18 + (l / lines) * 0.72);
          const alpha = (0.25 + (l / lines) * 0.45) * (isDarkMode ? 1 : 0.85);
          ctx.strokeStyle = `rgba(${colors.rgb}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let x = 0; x <= width; x += 18) {
            let ripple = 0;
            if (interactiveMouse && ptr.active) {
              const d = Math.hypot(x - ptr.x, baseY - ptr.y);
              if (d < 220) {
                ripple = Math.sin(d * 0.05 - phase * 2) * (1 - d / 220) * 24;
              }
            }
            const y =
              baseY +
              Math.sin(x * 0.005 + phase + l * 0.55) * 28 +
              Math.cos(x * 0.011 - phase * 0.8 + l) * 12 +
              ripple;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (effectiveStyle === 'hexgrid') {
        ctx.clearRect(0, 0, width, height);
        const size = 34;
        const hexW = size * Math.sqrt(3);
        const hexH = size * 1.5;
        const cols = Math.ceil(width / hexW) + 2;
        const rows = Math.ceil(height / hexH) + 2;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cx = c * hexW + (r % 2 === 1 ? hexW / 2 : 0);
            const cy = r * hexH;
            let boost = 0;
            if (interactiveMouse && ptr.active) {
              const dist = Math.hypot(cx - ptr.x, cy - ptr.y);
              if (dist < 180) boost = (1 - dist / 180) * 0.55;
            }
            const wave = (Math.sin(c * 0.35 + r * 0.35 + phase) + 1) * 0.1;
            const alpha = Math.min(0.85, (isDarkMode ? 0.14 : 0.12) + wave + boost);

            ctx.strokeStyle = `rgba(${colors.rgb}, ${alpha.toFixed(3)})`;
            ctx.lineWidth = boost > 0.1 ? 1.5 : 1;
            ctx.beginPath();
            for (let side = 0; side < 6; side++) {
              const ang = (Math.PI / 3) * side - Math.PI / 6;
              const px = cx + (size - 2) * Math.cos(ang);
              const py = cy + (size - 2) * Math.sin(ang);
              if (side === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            if (boost > 0.18) {
              ctx.fillStyle = `rgba(${colors.rgb}, ${(boost * 0.18).toFixed(3)})`;
              ctx.fill();
            }
          }
        }
      } else if (effectiveStyle === 'starfield') {
        ctx.clearRect(0, 0, width, height);
        const centerX =
          width / 2 + (interactiveMouse && ptr.active ? (ptr.x - width / 2) * 0.12 : 0);
        const centerY =
          height / 2 + (interactiveMouse && ptr.active ? (ptr.y - height / 2) * 0.12 : 0);

        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          s.z -= 3.2 * speedMultiplier;
          if (s.z <= 1) {
            s.z = width;
            s.x = (Math.random() - 0.5) * width * 1.4;
            s.y = (Math.random() - 0.5) * height * 1.4;
          }
          const k = 220 / s.z;
          const sx = s.x * k + centerX;
          const sy = s.y * k + centerY;
          if (sx < 0 || sx > width || sy < 0 || sy > height) continue;

          const size = Math.max(0.7, (1 - s.z / width) * 3.4);
          const alpha = Math.min(0.95, (1 - s.z / width) * 1.15);
          ctx.fillStyle = `rgba(${colors.rgb}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    effectiveStyle,
    color,
    customAccentHex,
    isDarkMode,
    speedMultiplier,
    interactiveMouse,
    colors.darkHead,
    colors.darkTrail,
    colors.lightHead,
    colors.lightTrail,
    colors.rgb,
  ]);

  if (effectiveStyle === 'minimal') {
    return null;
  }

  if (effectiveStyle === 'grid') {
    const lineColor = isDarkMode
      ? `rgba(${colors.rgb}, ${Math.max(0.08, Math.min(0.32, opacity * 0.9))})`
      : `rgba(${colors.rgb}, ${Math.max(0.08, Math.min(0.28, opacity * 0.78))})`;
    return (
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-300"
        style={{
          backgroundImage: `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse 85% 75% at 50% 25%, black 55%, transparent 100%)',
        }}
      />
    );
  }

  if (effectiveStyle === 'aurora') {
    const glowStrength = Math.max(0.14, Math.min(0.45, opacity * 1.25));
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-500">
        <div
          className="absolute -top-36 left-1/2 -translate-x-1/2 w-[900px] h-[440px] rounded-full blur-[120px]"
          style={{
            background: `radial-gradient(circle, rgba(${colors.rgb}, ${glowStrength}) 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute bottom-[-160px] right-[-100px] w-[560px] h-[560px] rounded-full blur-[130px]"
          style={{
            background: `radial-gradient(circle, rgba(${colors.rgb}, ${glowStrength * 0.65}) 0%, transparent 72%)`,
          }}
        />
      </div>
    );
  }

  // Canvas styles: matrix | constellation | waves | hexgrid | starfield
  const canvasOpacity =
    effectiveStyle === 'matrix'
      ? isDarkMode
        ? opacity
        : Math.min(0.45, opacity * 1.25)
      : isDarkMode
        ? Math.min(0.95, opacity * 2.1)
        : Math.min(0.75, opacity * 1.85);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none transition-opacity duration-500 z-0"
      style={{ opacity: canvasOpacity }}
    />
  );
};
