import { Capacitor } from '@capacitor/core';

let appliedStatusBarMode = null;
let statusBarRevision = 0;
let badgeQueue = Promise.resolve();
let badgeRevision = 0;
let lastBadgeCount = null;
let nativeBadgeSupported = null;

export function syncNativeAppearance(mode) {
  const isDark = mode === 'dark';
  const root = document.documentElement;
  const background = getComputedStyle(root).getPropertyValue('--bg').trim();
  root.style.colorScheme = isDark ? 'dark' : 'light';
  root.style.backgroundColor = background;
  const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (statusBarMeta) statusBarMeta.content = isDark ? 'black' : 'default';

  if (!Capacitor.isNativePlatform() || appliedStatusBarMode === mode) return;
  appliedStatusBarMode = mode;

  const revision = ++statusBarRevision;
  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => {
      const operations = [StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })];
      if (Capacitor.getPlatform() === 'android') {
        operations.push(StatusBar.setBackgroundColor({ color: background }));
      }
      return Promise.all(operations);
    })
    .catch((error) => {
      if (revision === statusBarRevision) appliedStatusBarMode = null;
      console.error('Aurora: não foi possível atualizar a barra de status nativa.', error);
    });
}

export function triggerHapticFeedback(kind = 'light') {
  const isSuccess = kind === 'success';
  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle, NotificationType }) =>
        isSuccess && NotificationType?.Success
          ? Haptics.notification({ type: NotificationType.Success })
          : Haptics.impact({ style: isSuccess ? ImpactStyle.Medium : ImpactStyle.Light }),
      )
      .catch((error) => {
        console.warn('Aurora: não foi possível emitir o retorno tátil.', error);
      });
    return;
  }
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(isSuccess ? [14, 32, 18] : 12);
  } catch (error) {
    console.warn('Aurora: não foi possível emitir o retorno tátil.', error);
  }
}

export function updateAppIconBadge(count) {
  if (!Number.isSafeInteger(count) || count < 0) {
    console.error('Aurora: a contagem do badge precisa ser um inteiro não negativo.');
    return badgeQueue;
  }
  const revision = ++badgeRevision;
  badgeQueue = badgeQueue
    .then(async () => {
      if (revision !== badgeRevision || count === lastBadgeCount) return;

      if (Capacitor.isNativePlatform()) {
        const { Badge } = await import('@capawesome/capacitor-badge');
        if (nativeBadgeSupported === null) {
          const result = await Badge.isSupported();
          nativeBadgeSupported = result.isSupported;
        }
        if (!nativeBadgeSupported || revision !== badgeRevision) return;
        await Badge.set({ count });
      } else {
        if (typeof navigator.setAppBadge !== 'function') return;
        if (count === 0) {
          if (typeof navigator.clearAppBadge !== 'function') return;
          await navigator.clearAppBadge();
        } else {
          await navigator.setAppBadge(count);
        }
      }

      if (revision === badgeRevision) lastBadgeCount = count;
    })
    .catch((error) => {
      console.error('Aurora: não foi possível atualizar o badge do aplicativo.', error);
    });
  return badgeQueue;
}
