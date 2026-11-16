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
  expectedEndTimeStr: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const reg = await getSWRegistration();
  if (reg) {
    const worker = reg.active || reg.waiting || reg.installing;
    if (worker) {
      worker.postMessage({
        type: 'START_LUNCH_TIMER',
        startEpoch,
        durationMinutes,
        expectedEndTimeStr,
      });
    }

    // Immediately show in the phone's notification bar even before SW finishes installing
    if (typeof reg.showNotification === 'function') {
      const targetEpoch = startEpoch + durationMinutes * 60 * 1000;
      const remainingMs = Math.max(0, targetEpoch - Date.now());
      const remainingMins = Math.max(1, Math.ceil(remainingMs / 60000));
      const label =
        remainingMs < 60000
          ? `menos de 1 min (${Math.max(1, Math.ceil(remainingMs / 1000))}s)`
          : `${remainingMins} min restantes`;

      try {
        await reg.showNotification(`🥪 Almoço Ativo: ${label}`, {
          body: `Retorno previsto às ${expectedEndTimeStr} • Alarme automático ativo`,
          icon: '/icon.svg',
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
        icon: '/icon.svg',
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
    for (const tag of ['ponto-lunch-countdown', 'ponto-lunch-alarm']) {
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
        icon: '/icon.svg',
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
      icon: '/icon.svg',
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
  notificationPermission: MobileNotificationStatus;
  hasDocumentPiP: boolean;
  isStandalonePWA: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

export function detectWidgetCapabilities(): WidgetCapabilities {
  if (typeof window === 'undefined') {
    return {
      hasServiceWorker: false,
      hasNotifications: false,
      notificationPermission: 'unsupported',
      hasDocumentPiP: false,
      isStandalonePWA: false,
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
    notificationPermission: getMobileNotificationStatus(),
    hasDocumentPiP: 'documentPictureInPicture' in window,
    isStandalonePWA,
    isIOS: /iphone|ipad|ipod/.test(ua),
    isAndroid: /android/.test(ua),
  };
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
        icon: '/assets/aistudio/image_3b45cbb0.png',
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

