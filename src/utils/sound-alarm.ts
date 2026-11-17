/**
 * Web Audio API synthesizer for customizable alarms and punch notifications
 * Supports 5 distinct melody / sound profiles
 */

import { AlarmSoundId } from './punch-rules';

let audioCtx: AudioContext | null = null;
let alarmIntervalId: number | null = null;
let isAlarmRinging = false;
let currentSoundId: AlarmSoundId = 'notification';

let keepAliveAudioEl: HTMLAudioElement | null = null;
let keepAliveUrl: string | null = null;
let alarmAudioEl: HTMLAudioElement | null = null;
let alarmAudioUrl: string | null = null;
let alarmAudioSoundId: AlarmSoundId | null = null;

export const ALARM_SOUND_PRESETS: {
  id: AlarmSoundId;
  name: string;
  description: string;
  iconName: string;
}[] = [
  {
    id: 'notification',
    name: 'Som de Notificação do Celular',
    description: 'Toque melódico suave característico de notificações do Android/iOS',
    iconName: 'BellRing',
  },
  {
    id: 'classic',
    name: 'Clássico Pernambucanas',
    description: 'Bips duplos tradicionais de alta audibilidade',
    iconName: 'Bell',
  },
  {
    id: 'digital',
    name: 'Despertador Digital',
    description: 'Trinado eletrônico rápido em tríade harmônica',
    iconName: 'Watch',
  },
  {
    id: 'bell',
    name: 'Sino Suave & Zen',
    description: 'Harmônicos de sino com ressonância acústica suave',
    iconName: 'Sparkles',
  },
  {
    id: 'cyber',
    name: 'Synthwave Matrix',
    description: 'Arpejo futurista estilo ficção científica neon',
    iconName: 'Activity',
  },
  {
    id: 'energetic',
    name: 'Alerta Dinâmico',
    description: 'Sequência energética de ritmo acelerado',
    iconName: 'Zap',
  },
];

function createWavBlobUrl(samples: Float32Array, sampleRate = 22050): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function getSilentWavUrl(): string {
  if (keepAliveUrl) return keepAliveUrl;
  // 1 second of near-zero PCM silence at 8kHz (~16KB)
  const sampleRate = 8000;
  const samples = new Float32Array(sampleRate);
  keepAliveUrl = createWavBlobUrl(samples, sampleRate);
  return keepAliveUrl;
}

function buildAlarmWavUrl(soundId: AlarmSoundId): string {
  if (alarmAudioUrl && alarmAudioSoundId === soundId) {
    return alarmAudioUrl;
  }
  if (alarmAudioUrl) {
    try {
      URL.revokeObjectURL(alarmAudioUrl);
    } catch {}
  }

  const sampleRate = 22050;
  const durationSec = 1.25;
  const length = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(length);

  const addTone = (freq: number, startSec: number, durSec: number, amp = 0.45, wave: 'sine' | 'square' | 'triangle' = 'sine') => {
    const startIdx = Math.floor(startSec * sampleRate);
    const endIdx = Math.min(length, Math.floor((startSec + durSec) * sampleRate));
    for (let i = startIdx; i < endIdx; i++) {
      const t = (i - startIdx) / sampleRate;
      const env = Math.min(1, t / 0.015) * Math.max(0, 1 - t / durSec);
      const phase = 2 * Math.PI * freq * t;
      let val = Math.sin(phase);
      if (wave === 'square') val = Math.sin(phase) >= 0 ? 0.7 : -0.7;
      else if (wave === 'triangle') val = (2 / Math.PI) * Math.asin(Math.sin(phase));
      samples[i] = Math.max(-0.95, Math.min(0.95, samples[i] + val * amp * env));
    }
  };

  switch (soundId) {
    case 'notification':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => addTone(f, idx * 0.09, 0.35, 0.5, 'sine'));
      break;
    case 'digital':
      [1046.5, 1318.5, 1567.98, 1046.5].forEach((f, idx) => addTone(f, idx * 0.11, 0.09, 0.4, 'square'));
      break;
    case 'bell':
      [523.25, 1046.5, 1567.98].forEach((f, idx) => addTone(f, 0.02, 1.1, 0.4 / (idx + 1), 'sine'));
      break;
    case 'cyber':
      [370.0, 440.0, 554.37, 659.25, 740.0].forEach((f, idx) => addTone(f, idx * 0.09, 0.16, 0.4, 'triangle'));
      break;
    case 'energetic':
      [880, 1174.66, 880, 1480].forEach((f, idx) => addTone(f, idx * 0.08, 0.08, 0.48, 'triangle'));
      break;
    case 'classic':
    default:
      addTone(880, 0.02, 0.18, 0.5, 'triangle');
      addTone(1318.51, 0.24, 0.24, 0.55, 'sine');
      break;
  }

  alarmAudioUrl = createWavBlobUrl(samples, sampleRate);
  alarmAudioSoundId = soundId;
  return alarmAudioUrl;
}

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Unlocks both WebAudio and HTML5 <audio> during a real user tap/click so
 * alarms can ring reliably later even when the screen is locked or minimized.
 */
export function unlockAudioEngine() {
  if (typeof window === 'undefined') return;
  try {
    getAudioContext();
  } catch {}

  try {
    if (!alarmAudioEl) {
      alarmAudioEl = new Audio();
      alarmAudioEl.preload = 'auto';
    }
  } catch {}
}

/**
 * Starts a silent background audio session + Android Lock-Screen MediaSession
 * while the lunch countdown is running so mobile browsers do not freeze the timer
 * when switching apps or locking the screen.
 */
export function startLunchBackgroundKeepAlive(expectedEndTimeStr: string) {
  if (typeof window === 'undefined') return;
  try {
    if (!keepAliveAudioEl) {
      keepAliveAudioEl = new Audio(getSilentWavUrl());
      keepAliveAudioEl.loop = true;
      keepAliveAudioEl.volume = 0.01;
    }
    keepAliveAudioEl.play().catch(() => {});

    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Almoço Ativo • Retorno às ${expectedEndTimeStr}`,
        artist: 'PontoFácil Pernambucanas',
        album: 'Alarme em Segundo Plano Ativado',
      });
      navigator.mediaSession.playbackState = 'playing';
    }
  } catch {}
}

export function stopLunchBackgroundKeepAlive() {
  if (typeof window === 'undefined') return;
  try {
    if (keepAliveAudioEl) {
      keepAliveAudioEl.pause();
      keepAliveAudioEl.currentTime = 0;
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
  } catch {}
}

export function setAlarmSound(soundId: AlarmSoundId) {
  currentSoundId = soundId;
}

export function getAlarmSound(): AlarmSoundId {
  return currentSoundId;
}

export function playPunchSuccessSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch (err) {
    console.warn('Audio play error:', err);
  }
}

/**
 * Plays a gentle 3-note preventive chime + short haptic vibration 1 minute
 * before lunch ends so the user holds the phone ready before :00 hits.
 */
export function playPreventiveLunchChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const notes = [698.46, 880, 1046.5]; // F5 -> A5 -> C6

    notes.forEach((freq, idx) => {
      const t = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  } catch (err) {
    console.warn('Preventive chime error:', err);
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([140, 80, 140]);
    } catch {}
  }
}

// Play specific alarm sound preset
export function playSoundPreset(soundId: AlarmSoundId = currentSoundId) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    switch (soundId) {
      case 'notification': {
        // Melodic Mobile Notification (C5 -> E5 -> G5 -> C6 ding-dong)
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.08;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.35);
        });
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch {}
        }
        break;
      }

      case 'digital': {
        const freqs = [1046.5, 1318.5, 1567.98];
        freqs.forEach((freq, idx) => {
          const t = now + idx * 0.09;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.01, t);
          gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.08);
        });
        break;
      }

      case 'bell': {
        const freqs = [523.25, 1046.5, 1567.98];
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          const vol = 0.3 / (i + 1);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(vol, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.2);
        });
        break;
      }

      case 'cyber': {
        const notes = [370.0, 440.0, 554.37, 659.25, 740.0];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.08;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.15);
        });
        break;
      }

      case 'energetic': {
        const seq = [880, 1174.66, 880, 1480];
        seq.forEach((freq, idx) => {
          const t = now + idx * 0.07;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.01, t);
          gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.065);
        });
        break;
      }

      case 'classic':
      default: {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.01, now);
        gain1.gain.exponentialRampToValueAtTime(0.4, now + 0.03);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.2);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.51, now + 0.22);
        gain2.gain.setValueAtTime(0.01, now + 0.22);
        gain2.gain.exponentialRampToValueAtTime(0.45, now + 0.25);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.42);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.22);
        osc2.stop(now + 0.45);
        break;
      }
    }
  } catch (err) {
    console.warn('Audio error:', err);
  }
}

export function startAlarmLoop(soundId: AlarmSoundId = currentSoundId) {
  if (isAlarmRinging) return;
  isAlarmRinging = true;

  // Stop silent background keepalive before playing full-volume alarm
  stopLunchBackgroundKeepAlive();

  // Play HTML5 <audio> WAV loop (most reliable on locked Android Chrome screens)
  try {
    const wavUrl = buildAlarmWavUrl(soundId);
    if (!alarmAudioEl) {
      alarmAudioEl = new Audio(wavUrl);
    } else {
      alarmAudioEl.src = wavUrl;
    }
    alarmAudioEl.loop = true;
    alarmAudioEl.volume = 1.0;
    alarmAudioEl.play().catch(() => {});
  } catch {}

  // Also synthesize WebAudio melody if context is active
  playSoundPreset(soundId);
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([500, 200, 500, 200, 800]);
    } catch {}
  }

  if (alarmIntervalId !== null) {
    window.clearInterval(alarmIntervalId);
  }

  alarmIntervalId = window.setInterval(() => {
    if (isAlarmRinging) {
      // Only re-trigger WebAudio if HTML5 audio didn't start (e.g. headless/fallback)
      if (!alarmAudioEl || alarmAudioEl.paused) {
        playSoundPreset(soundId);
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([500, 200, 500, 200, 800]);
        } catch {}
      }
    }
  }, 1400);
}

export function stopAlarmLoop() {
  isAlarmRinging = false;
  if (alarmIntervalId !== null) {
    window.clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
  if (alarmAudioEl) {
    try {
      alarmAudioEl.pause();
      alarmAudioEl.currentTime = 0;
    } catch {}
  }
}

export function isAlarmActive(): boolean {
  return isAlarmRinging;
}

export async function triggerSystemNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // On Android Chrome, new Notification() throws TypeError; always prefer SW showNotification
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: 'ponto-lunch-alarm',
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [500, 200, 500, 200, 800],
          data: { action: 'bater_ponto', url: '/?action=bater_ponto' },
          actions: [
            { action: 'bater_ponto', title: '▶️ Bater Ponto Agora' },
            { action: 'abrir', title: 'Abrir App' },
          ],
        } as NotificationOptions);
        return;
      }
    } catch {
      // Fallback below
    }
  }

  try {
    new Notification(title, {
      body,
      icon: '/icon.svg',
      tag: 'ponto-lunch-alarm',
      requireInteraction: true,
    });
  } catch (e) {
    console.warn('System notification error:', e);
  }
}
