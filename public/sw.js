/**
 * Service Worker for PontoFácil Pernambucanas
 * Handles persistent mobile notification bar alerts, TimestampTrigger scheduling,
 * and background recovery when the app is minimized, switched, or locked.
 */

const STATE_CACHE = 'pontofacil-state-v1';
const SHELL_CACHE = 'pontofacil-shell-v2';
const STATE_KEY = '/__lunch_timer_state__.json';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

let activeLunchTimeout = null;
let activePreAlertTimeout = null;
let activeLunchInterval = null;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => undefined))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATE_CACHE && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .catch(() => undefined)
      .then(() => self.clients.claim())
      .then(() => checkPersistedLunchTimer())
  );
});

async function saveLunchState(state) {
  try {
    const cache = await caches.open(STATE_CACHE);
    await cache.put(
      STATE_KEY,
      new Response(JSON.stringify(state), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (err) {
    // Ignore cache storage failures in restricted contexts
  }
}

async function loadLunchState() {
  try {
    const cache = await caches.open(STATE_CACHE);
    const res = await cache.match(STATE_KEY);
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteLunchState() {
  try {
    const cache = await caches.open(STATE_CACHE);
    await cache.delete(STATE_KEY);
  } catch {
    // Ignore
  }
}

function stopInternalTimers() {
  if (activeLunchTimeout) {
    clearTimeout(activeLunchTimeout);
    activeLunchTimeout = null;
  }
  if (activePreAlertTimeout) {
    clearTimeout(activePreAlertTimeout);
    activePreAlertTimeout = null;
  }
  if (activeLunchInterval) {
    clearInterval(activeLunchInterval);
    activeLunchInterval = null;
  }
}

async function firePreventivePreAlertNotification(state) {
  if (!state || state.alarmFired || state.preAlertFired) return;
  await saveLunchState({ ...state, preAlertFired: true });

  try {
    await self.registration.showNotification('⚠️ Falta 1 minuto para voltar do almoço!', {
      body: `Fique pronto com o celular para bater o ponto às ${state.expectedEndTimeStr || '--:--:00'}.`,
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
      tag: 'ponto-lunch-prealert',
      renotify: true,
      requireInteraction: false,
      silent: false,
      vibrate: [180, 90, 180],
      data: { action: 'abrir', url: '/' },
    });
  } catch {}
}

async function fireFinalAlarmNotification(state) {
  const durationMinutes = state?.durationMinutes || 60;
  const durationLabel = durationMinutes === 60 ? '1 hora' : `${durationMinutes} min`;

  // Mark alarm as fired in persisted state so we don't duplicate
  if (state && !state.alarmFired) {
    await saveLunchState({ ...state, alarmFired: true });
  }

  // Close countdown notification so the loud final alarm stands out clearly
  try {
    const countdownNotes = await self.registration.getNotifications({ tag: 'ponto-lunch-countdown' });
    countdownNotes.forEach((n) => n.close());
  } catch {}

  try {
    await self.registration.showNotification(`⏰ FIM DO ALMOÇO (${durationLabel})!`, {
      body: 'Seu horário de descanso terminou! Toque aqui para registrar o ponto de retorno agora.',
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
      tag: 'ponto-lunch-alarm',
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [500, 200, 500, 200, 800, 200, 500],
      data: { action: 'bater_ponto', url: '/?action=bater_ponto' },
      actions: [
        { action: 'bater_ponto', title: '▶️ Bater Ponto Agora' },
        { action: 'abrir', title: 'Abrir App' },
      ],
    });
  } catch {}

  // Notify any open/backgrounded app windows so audio + modal trigger immediately
  try {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      client.postMessage({
        type: 'LUNCH_ALARM_FIRED',
        targetEpoch: state?.targetEpoch || Date.now(),
      });
    }
  } catch {}
}

async function showOngoingCountdownNotification(state) {
  const remainingMs = (state?.targetEpoch || 0) - Date.now();
  if (remainingMs <= 0) {
    await fireFinalAlarmNotification(state);
    return;
  }

  const remainingMins = Math.max(1, Math.ceil(remainingMs / 60000));
  const label =
    remainingMs < 60000
      ? `menos de 1 min (${Math.ceil(remainingMs / 1000)}s)`
      : `${remainingMins} min restantes`;

  try {
    await self.registration.showNotification(`🥪 Almoço Ativo: ${label}`, {
      body: `Retorno previsto às ${state.expectedEndTimeStr || '--:--'} • Alarme automático ativo`,
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
    });
  } catch {}
}

async function scheduleNativeTriggerIfSupported(state) {
  try {
    if (
      typeof self.TimestampTrigger !== 'undefined' &&
      self.Notification &&
      'showTrigger' in self.Notification.prototype
    ) {
      // Cancel previous triggered alarm notifications
      try {
        const existing = await self.registration.getNotifications({
          tag: 'ponto-lunch-alarm',
          includeTriggered: true,
        });
        existing.forEach((n) => n.close());
      } catch {}

      const durationMinutes = state.durationMinutes || 60;
      const durationLabel = durationMinutes === 60 ? '1 hora' : `${durationMinutes} min`;
      const triggerTime = Math.max(Date.now() + 1000, state.targetEpoch);

      await self.registration.showNotification(`⏰ FIM DO ALMOÇO (${durationLabel})!`, {
        body: 'Seu horário de descanso terminou! Toque aqui para registrar o ponto de retorno agora.',
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'ponto-lunch-alarm',
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [500, 200, 500, 200, 800, 200, 500],
        showTrigger: new self.TimestampTrigger(triggerTime),
        data: { action: 'bater_ponto', url: '/?action=bater_ponto' },
        actions: [
          { action: 'bater_ponto', title: '▶️ Bater Ponto Agora' },
          { action: 'abrir', title: 'Abrir App' },
        ],
      });
    }
  } catch {
    // TimestampTrigger not supported on this browser — handled by SW timers & wake-up checks
  }
}

async function startLunchNotificationCycle(data) {
  stopInternalTimers();

  const { startEpoch, durationMinutes = 60, expectedEndTimeStr, targetEpoch: explicitTargetEpoch } = data;
  const targetEpoch =
    typeof explicitTargetEpoch === 'number' && Number.isFinite(explicitTargetEpoch)
      ? explicitTargetEpoch
      : startEpoch + durationMinutes * 60 * 1000;
  const state = {
    startEpoch,
    durationMinutes,
    targetEpoch,
    expectedEndTimeStr: expectedEndTimeStr || '--:--',
    alarmFired: false,
  };

  await saveLunchState(state);
  await scheduleNativeTriggerIfSupported(state);
  await showOngoingCountdownNotification(state);

  const remainingMs = Math.max(0, targetEpoch - Date.now());
  if (remainingMs <= 0) {
    await fireFinalAlarmNotification(state);
    return;
  }

  // Exact target timeout
  activeLunchTimeout = setTimeout(async () => {
    stopInternalTimers();
    const latest = (await loadLunchState()) || state;
    if (!latest.alarmFired) {
      await fireFinalAlarmNotification(latest);
    }
  }, remainingMs);

  // Preventive 1-minute warning timeout
  const preAlertDelayMs = remainingMs - 60000;
  if (preAlertDelayMs > 0) {
    activePreAlertTimeout = setTimeout(async () => {
      const latest = (await loadLunchState()) || state;
      await firePreventivePreAlertNotification(latest);
    }, preAlertDelayMs);
  }

  // Update mobile notification bar every 60s while SW stays awake
  activeLunchInterval = setInterval(async () => {
    const latest = await loadLunchState();
    if (!latest || latest.alarmFired) {
      stopInternalTimers();
      return;
    }
    if (Date.now() >= latest.targetEpoch) {
      stopInternalTimers();
      await fireFinalAlarmNotification(latest);
    } else {
      if (latest.targetEpoch - Date.now() <= 60000 && !latest.preAlertFired) {
        await firePreventivePreAlertNotification(latest);
      }
      await showOngoingCountdownNotification(latest);
    }
  }, 60000);
}

async function checkPersistedLunchTimer() {
  const state = await loadLunchState();
  if (!state || state.alarmFired) return;

  const remainingMs = state.targetEpoch - Date.now();
  if (remainingMs <= 0) {
    stopInternalTimers();
    await fireFinalAlarmNotification(state);
  } else if (!activeLunchTimeout) {
    // Re-arm SW timers if SW restarted
    activeLunchTimeout = setTimeout(async () => {
      stopInternalTimers();
      const latest = (await loadLunchState()) || state;
      if (!latest.alarmFired) {
        await fireFinalAlarmNotification(latest);
      }
    }, remainingMs);
  }
}

async function clearLunchNotification() {
  stopInternalTimers();
  await deleteLunchState();

  const tags = ['ponto-lunch-countdown', 'ponto-lunch-prealert', 'ponto-lunch-alarm'];
  for (const tag of tags) {
    try {
      const notifications = await self.registration.getNotifications({ tag, includeTriggered: true });
      notifications.forEach((n) => n.close());
    } catch {
      try {
        const notifications = await self.registration.getNotifications({ tag });
        notifications.forEach((n) => n.close());
      } catch {}
    }
  }
}

const WIDGET_DATA_KEY = '/widgets/today-punches-data.json';

async function saveWidgetData(payload) {
  try {
    const cache = await caches.open(STATE_CACHE);
    await cache.put(
      WIDGET_DATA_KEY,
      new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch {}
}

async function loadWidgetData() {
  try {
    const cache = await caches.open(STATE_CACHE);
    const res = await cache.match(WIDGET_DATA_KEY);
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateAdaptiveCardWidget(payload) {
  try {
    if (self.widgets && typeof self.widgets.updateByTag === 'function') {
      const tplRes = await fetch('/widgets/today-punches-template.json').catch(() => null);
      const template = tplRes && tplRes.ok ? await tplRes.text() : undefined;
      await self.widgets.updateByTag('ponto-hoje', {
        ...(template ? { template } : {}),
        data: JSON.stringify(payload),
      });
    }
  } catch {}
}

async function syncTodayPunchWidget(payload, pinned) {
  if (!payload) return;
  await saveWidgetData(payload);
  await updateAdaptiveCardWidget(payload);

  if (pinned) {
    try {
      await self.registration.showNotification(payload.notificationTitle || '📋 PontoFácil • Marcações de Hoje', {
        body: payload.notificationBody || 'Acompanhe suas marcações do dia em tempo real.',
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
      });
    } catch {}
  }
}

async function clearTodayPunchWidget() {
  try {
    const existing = await self.registration.getNotifications({ tag: 'ponto-widget-hoje' });
    existing.forEach((n) => n.close());
  } catch {}
}

function isOfflineCacheableStaticPath(pathname) {
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/lg-p/') ||
    pathname.startsWith('/autenticacao') ||
    pathname.startsWith('/Autoatendimento') ||
    pathname.startsWith('/Api.') ||
    pathname.startsWith('/LG.') ||
    pathname.startsWith('/@vite') ||
    pathname.startsWith('/@react-refresh') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/')
  ) {
    return false;
  }
  return true;
}

// Serve cached widget JSON directly for PWA Adaptive Cards + offline app-shell fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  try {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    if (url.pathname === WIDGET_DATA_KEY) {
      event.respondWith(
        loadWidgetData().then((cached) => {
          if (cached) {
            return new Response(JSON.stringify(cached), {
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            });
          }
          return fetch(event.request);
        })
      );
      return;
    }

    if (!isOfflineCacheableStaticPath(url.pathname)) return;

    // Navigation requests: network-first, fallback to cached shell when offline
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
            }
            return res;
          })
          .catch(async () => {
            const cached = (await caches.match(event.request)) || (await caches.match('/index.html')) || (await caches.match('/'));
            return cached || Response.error();
          })
      );
      return;
    }

    // Built/static assets (/assets/*, *.png, *.svg, /manifest.json): stale-while-revalidate
    if (
      url.pathname.startsWith('/assets/') ||
      /\.(png|svg|ico|webmanifest|json|css|js)$/i.test(url.pathname)
    ) {
      event.respondWith(
        caches.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request)
            .then((res) => {
              if (res && res.ok) {
                const copy = res.clone();
                caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
              }
              return res;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      );
    }
  } catch {}
});

// Handle incoming Web Push messages even when the app is completely closed
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch {
        const text = event.data ? event.data.text() : '';
        data = { body: text };
      }

      const pushType = data.type || 'alarm';

      if (pushType === 'prealert') {
        const existing = await loadLunchState();
        if (existing) {
          await saveLunchState({ ...existing, preAlertFired: true });
        }
        await self.registration.showNotification(
          data.title || '⚠️ Falta 1 minuto para voltar do almoço!',
          {
            body:
              data.body ||
              `Fique pronto com o celular para bater o ponto às ${data.expectedEndTimeStr || '--:--:00'}.`,
            icon: '/pwa-192x192.png',
            badge: '/icon.svg',
            tag: 'ponto-lunch-prealert',
            renotify: true,
            requireInteraction: false,
            silent: false,
            vibrate: [180, 90, 180],
            data: { action: 'abrir', url: '/' },
            actions: [{ action: 'abrir', title: 'Abrir App' }],
          }
        );
        return;
      }

      if (pushType === 'test') {
        await self.registration.showNotification(
          data.title || '🔔 Push Real (App Fechado) — PontoFácil',
          {
            body:
              data.body ||
              'Teste de segundo plano recebido com sucesso! O despertador funcionará mesmo com o app fechado.',
            icon: '/pwa-192x192.png',
            badge: '/icon.svg',
            tag: 'ponto-test-push',
            renotify: true,
            requireInteraction: false,
            silent: false,
            vibrate: [250, 120, 250],
            data: { action: 'abrir', url: '/?tab=widget' },
            actions: [
              { action: 'bater_ponto', title: '▶️ Bater Ponto' },
              { action: 'abrir', title: 'Abrir App' },
            ],
          }
        );
        return;
      }

      // Default: 'alarm' (end of lunch)
      const existing = await loadLunchState();
      await saveLunchState({
        ...(existing || {}),
        durationMinutes: data.durationMinutes || existing?.durationMinutes || 60,
        expectedEndTimeStr: data.expectedEndTimeStr || existing?.expectedEndTimeStr || '--:--:00',
        targetEpoch: data.targetEpoch || existing?.targetEpoch || Date.now(),
        alarmFired: true,
      });

      try {
        const countdownNotes = await self.registration.getNotifications({ tag: 'ponto-lunch-countdown' });
        countdownNotes.forEach((n) => n.close());
      } catch {}

      await self.registration.showNotification(
        data.title || '⏰ FIM DO ALMOÇO! Hora de bater o ponto',
        {
          body:
            data.body ||
            'Seu horário de almoço terminou! Toque em "Bater Ponto Agora" para abrir e registrar no Portal.',
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          tag: 'ponto-lunch-alarm',
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [500, 200, 500, 200, 800, 200, 500],
          data: { action: 'bater_ponto', url: '/?action=bater_ponto' },
          actions: [
            { action: 'bater_ponto', title: '▶️ Bater Ponto Agora' },
            { action: 'abrir', title: 'Abrir App' },
          ],
        }
      );

      try {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({
            type: 'LUNCH_ALARM_FIRED',
            targetEpoch: data.targetEpoch || Date.now(),
          });
        }
      } catch {}
    })()
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
      }
    })
  );
});

// Handle incoming messages from the React app
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'START_LUNCH_TIMER') {
    event.waitUntil(startLunchNotificationCycle(data));
  } else if (data.type === 'FIRE_LUNCH_ALARM_NOW') {
    event.waitUntil(
      (async () => {
        const existing = await loadLunchState();
        if (existing && existing.alarmFired) return;
        await fireFinalAlarmNotification(existing || { durationMinutes: data.durationMinutes || 60 });
      })()
    );
  } else if (data.type === 'CHECK_LUNCH_TIMER') {
    event.waitUntil(checkPersistedLunchTimer());
  } else if (data.type === 'CLEAR_LUNCH_TIMER') {
    event.waitUntil(clearLunchNotification());
  } else if (data.type === 'SYNC_WIDGET_PUNCHES') {
    event.waitUntil(syncTodayPunchWidget(data.payload, Boolean(data.pinned)));
  } else if (data.type === 'CLEAR_WIDGET_PUNCHES') {
    event.waitUntil(clearTodayPunchWidget());
  } else if (data.type === 'TEST_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification('🔔 PontoFácil Pernambucanas', {
        body: 'Notificação ativa na barra do celular! O contador e o alarme de almoço aparecerão aqui.',
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'ponto-test',
        renotify: true,
        silent: false,
        vibrate: [250, 120, 250],
        data: { action: 'abrir', url: '/' },
        actions: [{ action: 'abrir', title: 'Abrir App' }],
      })
    );
  }
});

// Edge / Chromium PWA Widgets lifecycle
self.addEventListener('widgetinstall', (event) => {
  event.waitUntil(
    loadWidgetData().then((payload) => {
      if (payload) return updateAdaptiveCardWidget(payload);
    })
  );
});

self.addEventListener('widgetclick', (event) => {
  if (event.action === 'bater_ponto') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.postMessage({ type: 'NOTIFICATION_ACTION', action: 'bater_ponto' });
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow('/?action=bater_ponto');
      })
    );
  }
});

// Opportunistic check when SW wakes up for background sync / periodic sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'ponto-lunch-check') {
    event.waitUntil(checkPersistedLunchTimer());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'ponto-lunch-check') {
    event.waitUntil(checkPersistedLunchTimer());
  }
});

// User clicked on notification or action button
self.addEventListener('notificationclick', (event) => {
  const action = event.action || (event.notification.data && event.notification.data.action);

  if (action === 'atualizar_widget') {
    event.waitUntil(
      loadWidgetData().then((payload) => syncTodayPunchWidget(payload, true))
    );
    return;
  }

  event.notification.close();
  const targetUrl =
    action === 'bater_ponto'
      ? '/?action=bater_ponto'
      : action === 'abrir_widget'
        ? '/?tab=widget'
        : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_ACTION', action: action || 'abrir' });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

