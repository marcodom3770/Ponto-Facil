/**
 * Client-side Service Worker manager for persistent mobile phone notification bar & background alerts
 */

let swRegistration: ServiceWorkerRegistration | null = null;

export type MobileNotificationStatus = NotificationPermission | 'unsupported';

export function getMobileNotificationStatus(): MobileNotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    try {
      const readyReg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (readyReg) swRegistration = readyReg;
    } catch {}
    return swRegistration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  if (swRegistration?.active) return swRegistration;

  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (readyReg) {
      swRegistration = readyReg;
      return readyReg;
    }
  } catch {
    return swRegistration;
  }
  return swRegistration;
}

/**
 * Must be called directly inside a user tap/click handler so Android Chrome
 * preserves the user activation gesture when displaying the permission prompt.
 */
export async function requestMobileNotificationPermission(): Promise<MobileNotificationStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  let permission: NotificationPermission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  // Ensure SW is registered and ready immediately after permission
  await registerServiceWorker();
  return permission;
}

export async function startMobileLunchNotification(
  startEpoch: number,
  durationMinutes: number,
  expectedEndTimeStr: string,
  explicitTargetEpoch?: number
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const targetEpoch =
    typeof explicitTargetEpoch === 'number' && Number.isFinite(explicitTargetEpoch)
      ? explicitTargetEpoch
      : startEpoch + durationMinutes * 60 * 1000;

  const reg = await getSWRegistration();
  if (reg) {
    const worker = reg.active || reg.waiting || reg.installing;
    if (worker) {
      worker.postMessage({
        type: 'START_LUNCH_TIMER',
        startEpoch,
        durationMinutes,
        expectedEndTimeStr,
        targetEpoch,
      });
    }

    // Immediately show in the phone's notification bar even before SW finishes installing
    if (typeof reg.showNotification === 'function') {
      const remainingMs = Math.max(0, targetEpoch - Date.now());
      const remainingMins = Math.max(1, Math.ceil(remainingMs / 60000));
      const label =
        remainingMs < 60000
          ? `menos de 1 min (${Math.max(1, Math.ceil(remainingMs / 1000))}s)`
          : `${remainingMins} min restantes`;

      try {
        await reg.showNotification(`🥪 Almoço Ativo: ${label}`, {
          body: `Retorno previsto às ${expectedEndTimeStr} • Alarme automático ativo`,
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          tag: 'ponto-lunch-countdown',
          renotify: false,
          silent: true,
          requireInteraction: true,
          data: { action: 'abrir', url: '/' },
          actions: [
            { action: 'bater_ponto', title: 'Bater Retorno' },
            { action: 'abrir', title: 'Abrir App' },
          ],
        } as NotificationOptions);
        return true;
      } catch (err) {
        console.warn('reg.showNotification failed:', err);
      }
    }
  }

  return false;
}

export async function checkMobileLunchNotification() {
  const reg = await getSWRegistration();
  const worker = reg?.active || reg?.waiting;
  if (worker) {
    worker.postMessage({ type: 'CHECK_LUNCH_TIMER' });
  }
}

export async function fireMobileAlarmNotificationNow(durationMinutes: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const reg = await getSWRegistration();
  if (reg?.active) {
    reg.active.postMessage({
      type: 'FIRE_LUNCH_ALARM_NOW',
      durationMinutes,
    });
    return;
  }

  if (reg && typeof reg.showNotification === 'function') {
    const durationLabel = durationMinutes === 60 ? '1 hora' : `${durationMinutes} min`;
    try {
      await reg.showNotification(`⏰ FIM DO ALMOÇO (${durationLabel})!`, {
        body: 'Seu horário de descanso terminou! Toque aqui para registrar o ponto de retorno agora.',
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'ponto-lunch-alarm',
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [500, 200, 500, 200, 800],
        data: { action: 'bater_ponto', url: '/?action=bater_ponto' },
      } as NotificationOptions);
    } catch {}
  }
}

export async function clearMobileLunchNotification() {
  const reg = await getSWRegistration();
  if (reg?.active) {
    reg.active.postMessage({ type: 'CLEAR_LUNCH_TIMER' });
  }
  if (reg && typeof reg.getNotifications === 'function') {
    for (const tag of ['ponto-lunch-countdown', 'ponto-lunch-prealert', 'ponto-lunch-alarm']) {
      try {
        const list = await reg.getNotifications({ tag });
        list.forEach((n) => n.close());
      } catch {}
    }
  }
}

export async function sendMobileTestNotification(): Promise<{
  ok: boolean;
  permission: MobileNotificationStatus;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, permission: 'unsupported', error: 'Navegador sem suporte a notificações.' };
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await requestMobileNotificationPermission();

  if (permission !== 'granted') {
    return {
      ok: false,
      permission,
      error:
        permission === 'denied'
          ? 'Permissão bloqueada no navegador. Libere nas configurações do site no Chrome.'
          : 'Permissão de notificação não foi concedida.',
    };
  }

  const reg = await getSWRegistration();
  if (reg && typeof reg.showNotification === 'function') {
    try {
      await reg.showNotification('🔔 PontoFácil Pernambucanas', {
        body: 'Notificação ativa na barra do celular! O contador e o alarme de almoço aparecerão aqui.',
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'ponto-test',
        renotify: true,
        silent: false,
        vibrate: [250, 120, 250],
        data: { action: 'abrir', url: '/' },
        actions: [{ action: 'abrir', title: 'Abrir App' }],
      } as NotificationOptions);
      return { ok: true, permission: 'granted' };
    } catch (err) {
      return {
        ok: false,
        permission: 'granted',
        error: err instanceof Error ? err.message : 'Erro ao exibir notificação.',
      };
    }
  }

  if (reg?.active) {
    reg.active.postMessage({ type: 'TEST_NOTIFICATION' });
    return { ok: true, permission: 'granted' };
  }

  try {
    new Notification('🔔 PontoFácil Pernambucanas', {
      body: 'Notificação ativa! O alarme de almoço aparecerá aqui.',
      icon: '/pwa-192x192.png',
    });
    return { ok: true, permission: 'granted' };
  } catch (err) {
    return {
      ok: false,
      permission: 'granted',
      error: err instanceof Error ? err.message : 'Service Worker ainda inicializando.',
    };
  }
}

export interface WidgetCapabilities {
  hasServiceWorker: boolean;
  hasNotifications: boolean;
  hasPushManager: boolean;
  notificationPermission: MobileNotificationStatus;
  hasDocumentPiP: boolean;
  isStandalonePWA: boolean;
  isNativeOverlayApp: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

export interface PontoFacilAndroidBridge {
  isNativeWrapper?: () => boolean;
  hasOverlayPermission?: () => boolean;
  requestOverlayPermission?: () => void;
  scheduleLunchAlarm?: (targetEpochMs: number, expectedEndStr: string) => void;
  cancelLunchAlarm?: () => void;
}

function getAndroidBridge(): PontoFacilAndroidBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as { PontoFacilAndroid?: PontoFacilAndroidBridge })
    .PontoFacilAndroid;
  return bridge || null;
}

export function isRunningInAndroidOverlayWrapper(): boolean {
  const bridge = getAndroidBridge();
  if (!bridge) return false;
  try {
    return typeof bridge.isNativeWrapper === 'function' ? Boolean(bridge.isNativeWrapper()) : true;
  } catch {
    return false;
  }
}

export function getAndroidOverlayStatus(): {
  isNativeWrapper: boolean;
  hasOverlayPermission: boolean;
} {
  const bridge = getAndroidBridge();
  if (!bridge) {
    return { isNativeWrapper: false, hasOverlayPermission: false };
  }
  try {
    return {
      isNativeWrapper:
        typeof bridge.isNativeWrapper === 'function' ? Boolean(bridge.isNativeWrapper()) : true,
      hasOverlayPermission:
        typeof bridge.hasOverlayPermission === 'function'
          ? Boolean(bridge.hasOverlayPermission())
          : false,
    };
  } catch {
    return { isNativeWrapper: false, hasOverlayPermission: false };
  }
}

export function requestAndroidOverlayPermission(): boolean {
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.requestOverlayPermission === 'function') {
    bridge.requestOverlayPermission();
    return true;
  }
  return false;
}

export function scheduleAndroidNativeLunchAlarm(
  targetEpoch: number,
  expectedEndTimeStr: string
): boolean {
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.scheduleLunchAlarm === 'function') {
    try {
      bridge.scheduleLunchAlarm(targetEpoch, expectedEndTimeStr);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function cancelAndroidNativeLunchAlarm(): boolean {
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.cancelLunchAlarm === 'function') {
    try {
      bridge.cancelLunchAlarm();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function detectWidgetCapabilities(): WidgetCapabilities {
  if (typeof window === 'undefined') {
    return {
      hasServiceWorker: false,
      hasNotifications: false,
      hasPushManager: false,
      notificationPermission: 'unsupported',
      hasDocumentPiP: false,
      isStandalonePWA: false,
      isNativeOverlayApp: false,
      isIOS: false,
      isAndroid: false,
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isStandalonePWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  return {
    hasServiceWorker: 'serviceWorker' in navigator,
    hasNotifications: 'Notification' in window,
    hasPushManager: 'PushManager' in window,
    notificationPermission: getMobileNotificationStatus(),
    hasDocumentPiP: 'documentPictureInPicture' in window,
    isStandalonePWA,
    isNativeOverlayApp: isRunningInAndroidOverlayWrapper(),
    isIOS: /iphone|ipad|ipod/.test(ua),
    isAndroid: /android/.test(ua),
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getExistingWebPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  try {
    const reg = await getSWRegistration();
    if (!reg?.pushManager) return null;
    const sub = await reg.pushManager.getSubscription();
    return sub ? sub.toJSON() : null;
  } catch {
    return null;
  }
}

export async function ensureWebPushSubscription(interactive = false): Promise<{
  ok: boolean;
  subscription?: PushSubscriptionJSON;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Este navegador não suporta Web Push em segundo plano.' };
  }

  if (!('Notification' in window)) {
    return { ok: false, error: 'API de notificações indisponível.' };
  }

  let perm = Notification.permission;
  if (perm === 'default' && interactive) {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') {
    return {
      ok: false,
      error:
        perm === 'denied'
          ? 'Permissão de notificação bloqueada nas configurações do navegador.'
          : 'Permissão de notificação ainda não concedida.',
    };
  }

  const reg = await getSWRegistration();
  if (!reg || !reg.pushManager) {
    return { ok: false, error: 'Service Worker / PushManager indisponível neste dispositivo.' };
  }

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const keyRes = await fetch('/api/push/vapid-public-key');
      if (!keyRes.ok) {
        return { ok: false, error: 'Falha ao obter chave VAPID do servidor.' };
      }
      const { publicKey } = (await keyRes.json()) as { publicKey?: string };
      if (!publicKey) {
        return { ok: false, error: 'Chave pública VAPID não configurada no servidor.' };
      }

      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    }

    const subJson = sub.toJSON();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subJson }),
    }).catch(() => undefined);

    return { ok: true, subscription: subJson };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Não foi possível ativar Web Push (no iPhone exige instalar na Tela de Início).',
    };
  }
}

export async function scheduleServerLunchPush(
  targetEpoch: number,
  durationMinutes: number,
  expectedEndTimeStr: string
): Promise<boolean> {
  const resSub = await ensureWebPushSubscription(false);
  if (!resSub.ok || !resSub.subscription) return false;
  try {
    const res = await fetch('/api/push/schedule-lunch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: resSub.subscription,
        targetEpoch,
        durationMinutes,
        expectedEndTimeStr,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function cancelServerLunchPush(): Promise<void> {
  try {
    const existing = await getExistingWebPushSubscription();
    await fetch('/api/push/cancel-lunch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: existing?.endpoint || '' }),
    });
  } catch {}
}

export async function sendServerBackgroundTestPush(delaySeconds = 5): Promise<{
  ok: boolean;
  scheduledInSeconds?: number;
  error?: string;
}> {
  const resSub = await ensureWebPushSubscription(true);
  if (!resSub.ok || !resSub.subscription) {
    return { ok: false, error: resSub.error || 'Falha ao ativar Web Push.' };
  }
  try {
    const res = await fetch('/api/push/test-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: resSub.subscription,
        delaySeconds,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      scheduledInSeconds?: number;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Falha ao disparar Push no servidor.' };
    }
    return { ok: true, scheduledInSeconds: data.scheduledInSeconds ?? delaySeconds };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro de rede ao agendar Push.',
    };
  }
}

export interface WidgetNotificationPayloadInput {
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

export async function syncMobileTodayWidget(
  payload: WidgetNotificationPayloadInput,
  pinned: boolean
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const reg = await getSWRegistration();
  const worker = reg?.active || reg?.waiting || reg?.installing;
  if (worker) {
    worker.postMessage({
      type: 'SYNC_WIDGET_PUNCHES',
      payload,
      pinned: pinned && getMobileNotificationStatus() === 'granted',
    });
  }

  if (pinned && 'Notification' in window && Notification.permission === 'granted' && reg?.showNotification) {
    try {
      await reg.showNotification(payload.notificationTitle, {
        body: payload.notificationBody,
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'ponto-widget-hoje',
        renotify: false,
        silent: true,
        requireInteraction: true,
        data: { action: 'abrir_widget', url: '/?tab=widget' },
        actions: [
          { action: 'bater_ponto', title: '▶️ Bater Ponto' },
          { action: 'atualizar_widget', title: '🔄 Atualizar' },
        ],
      } as NotificationOptions);
      return true;
    } catch {
      return false;
    }
  }
  return Boolean(worker);
}

export async function clearMobileTodayWidget(): Promise<void> {
  if (typeof window === 'undefined') return;
  const reg = await getSWRegistration();
  if (reg?.active) {
    reg.active.postMessage({ type: 'CLEAR_WIDGET_PUNCHES' });
  }
  if (reg && typeof reg.getNotifications === 'function') {
    try {
      const list = await reg.getNotifications({ tag: 'ponto-widget-hoje' });
      list.forEach((n) => n.close());
    } catch {}
  }
}

