import { Capacitor } from '@capacitor/core';
import { isNativeApp } from '../utils/platform.js';
import { PUSH_NOTIFICATIONS_API_URL } from './push-notifications-config.js';

const LEGACY_STORAGE_KEY = 'aurora.push.pomodoro';
let mutationQueue = Promise.resolve();
let credentialStore = null;
let activeCredentials = null;
let nativePushPlugin = null;
let nativePushListenersReady = false;
let nativePushListenersPromise = null;
let nativePushConfigured = false;
let nativePushPermission = 'prompt';
let nativeRegistrationWaiter = null;

function serializeMutation(operation) {
  const pending = mutationQueue.catch(() => {}).then(operation);
  mutationQueue = pending.catch(() => {});
  return pending;
}

function readLegacyCredentials() {
  let value;
  try {
    value = localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.error('Aurora: não foi possível ler a autorização Push antiga.', error);
    throw new Error('legacy-storage');
  }
  if (!value) return null;
  try {
    const stored = JSON.parse(value);
    if (
      stored
      && typeof stored.clientId === 'string'
      && /^[A-Za-z0-9_-]{20,64}$/.test(stored.clientId)
      && typeof stored.capability === 'string'
      && /^[A-Za-z0-9_-]{32,64}$/.test(stored.capability)
    ) return { clientId: stored.clientId, capability: stored.capability };
  } catch (error) {
    console.error('Aurora: a autorização Push antiga está inválida.', error);
    throw new Error('legacy-invalid');
  }
  throw new Error('legacy-invalid');
}

function removeLegacyCredentials() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.error('Aurora: não foi possível remover a autorização Push antiga após a migração.', error);
    throw new Error('legacy-cleanup');
  }
}

export function configurePushNotificationStore(store) {
  credentialStore = store;
  activeCredentials = null;
  nativePushConfigured = false;
}

export async function initializePushNotifications() {
  activeCredentials = null;
  if (!credentialStore) return;
  if (isNativeApp()) {
    await initializeNativePush();
    return;
  }
  const legacyCredentials = readLegacyCredentials();
  const registration = 'serviceWorker' in navigator
    ? await navigator.serviceWorker.getRegistration()
    : null;
  const subscription = registration?.pushManager
    ? await registration.pushManager.getSubscription()
    : null;
  if (!subscription) {
    if (legacyCredentials) {
      await request('/api/subscription', { method: 'DELETE', credentials: legacyCredentials });
      removeLegacyCredentials();
    }
    return;
  }
  activeCredentials = await credentialStore.findPushSubscription(subscription.endpoint);
  if (activeCredentials && legacyCredentials) {
    if (activeCredentials.clientId !== legacyCredentials.clientId) {
      await request('/api/subscription', { method: 'DELETE', credentials: legacyCredentials });
    }
    removeLegacyCredentials();
  }
  if (!activeCredentials && legacyCredentials) {
    const serializedSubscription = subscription.toJSON();
    await serializeMutation(async () => {
      await request('/api/subscription', {
        method: 'POST',
        credentials: legacyCredentials,
        body: { subscription: serializedSubscription },
      });
      activeCredentials = await credentialStore.savePushSubscription(legacyCredentials, serializedSubscription);
      removeLegacyCredentials();
    });
  }
}

export function clearPushNotificationState() {
  activeCredentials = null;
  credentialStore = null;
}

async function loadNativePushPlugin() {
  if (!nativePushPlugin) {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    nativePushPlugin = PushNotifications;
  }
  return nativePushPlugin;
}

async function ensureNativePushListeners() {
  if (nativePushListenersReady) return nativePushPlugin;
  if (nativePushListenersPromise) return nativePushListenersPromise;
  nativePushListenersPromise = (async () => {
    const plugin = await loadNativePushPlugin();
    await plugin.addListener('registration', ({ value }) => {
      if (Capacitor.getPlatform() !== 'android') return;
      void saveNativePushToken(value).then((credentials) => {
        const waiter = nativeRegistrationWaiter;
        if (!waiter) return;
        clearTimeout(waiter.timeout);
        nativeRegistrationWaiter = null;
        waiter.resolve(credentials);
      }).catch(nativePushError);
    });
    await plugin.addListener('registrationError', nativePushError);
    await plugin.addListener('pushNotificationReceived', (notification) => {
      const kind = notification.data?.kind;
      if (kind === 'habit-reminder' || kind === 'task-reminder' || kind === 'weekly-review') {
        window.dispatchEvent(new CustomEvent('aurora:push-notification', { detail: { kind } }));
      }
    });
    await plugin.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const route = notification.data?.kind === 'habit-reminder'
        ? '/habitos'
        : notification.data?.kind === 'weekly-review'
          ? '/planejar?revisao=semana'
          : notification.data?.kind === 'task-reminder' ? '/planejar' : '';
      if (route) window.location.assign(route);
    });
    if (Capacitor.getPlatform() === 'ios') {
      const { FCM } = await import('@capacitor-community/fcm');
      await FCM.addListener('tokenReceived', ({ token }) => {
        void saveNativePushToken(token).then((credentials) => {
          const waiter = nativeRegistrationWaiter;
          if (!waiter) return;
          clearTimeout(waiter.timeout);
          nativeRegistrationWaiter = null;
          waiter.resolve(credentials);
        }).catch(nativePushError);
      });
    }
    nativePushListenersReady = true;
    return plugin;
  })();
  try {
    return await nativePushListenersPromise;
  } catch (error) {
    nativePushListenersPromise = null;
    throw error;
  }
}

function nativePushError(error) {
  const waiter = nativeRegistrationWaiter;
  if (!waiter) {
    console.error('Aurora: o registro nativo de Push falhou.', error);
    return;
  }
  clearTimeout(waiter.timeout);
  nativeRegistrationWaiter = null;
  waiter.reject(new Error('native-registration'));
}

async function saveNativePushToken(token) {
  return serializeMutation(async () => {
    if (!credentialStore || typeof token !== 'string' || !/^[A-Za-z0-9:_-]{20,4096}$/.test(token)) {
      throw new Error('native-registration');
    }
    const subscription = { provider: 'fcm', token };
    const previousCredentials = activeCredentials;
    let credentials = await credentialStore.findPushSubscription(token);
    if (!credentials?.clientId || !credentials?.capability) {
      const created = await request('/api/clients', { method: 'POST', body: {} });
      credentials = { clientId: created.clientId, capability: created.capability, enabled: false };
    }
    await request('/api/subscription', {
      method: 'POST',
      credentials,
      body: { subscription },
    });
    let savedCredentials;
    try {
      savedCredentials = await credentialStore.savePushSubscription(credentials, subscription);
    } catch (error) {
      try {
        await request('/api/subscription', { method: 'DELETE', credentials });
      } catch (cleanupError) {
        console.error('Aurora: a inscrição nativa não pôde ser revertida no serviço após falha do banco.', cleanupError);
      }
      throw error;
    }
    activeCredentials = savedCredentials;
    if (
      previousCredentials?.subscription?.provider === 'fcm'
      && previousCredentials.clientId !== savedCredentials.clientId
    ) {
      await request('/api/subscription', { method: 'DELETE', credentials: previousCredentials });
      await credentialStore.deletePushSubscription(previousCredentials.clientId);
    }
    return savedCredentials;
  });
}

async function registerNativePush(beforeRegister) {
  const plugin = await ensureNativePushListeners();
  if (nativeRegistrationWaiter) return nativeRegistrationWaiter.promise;
  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => nativePushError(new Error('registration-timeout')), 20_000);
    nativeRegistrationWaiter = { resolve, reject, timeout, promise: null };
  });
  nativeRegistrationWaiter.promise = promise;
  try {
    await beforeRegister?.();
    await plugin.register();
  } catch (error) {
    nativePushError(error);
  }
  return promise;
}

async function initializeNativePush() {
  const config = await request('/api/config');
  nativePushConfigured = config.nativePushEnabled === true;
  if (!nativePushConfigured) return;
  const plugin = await loadNativePushPlugin();
  nativePushPermission = (await plugin.checkPermissions()).receive;
  if (nativePushPermission !== 'granted' || !await credentialStore.hasPushSubscriptionProvider('fcm')) return;
  const { FCM } = await import('@capacitor-community/fcm');
  await registerNativePush(() => FCM.setAutoInit({ enabled: true }));
}

async function enableNativePush() {
  const config = await request('/api/config');
  nativePushConfigured = config.nativePushEnabled === true;
  if (!nativePushConfigured) throw new Error('native-not-configured');
  const plugin = await loadNativePushPlugin();
  let permission = await plugin.checkPermissions();
  nativePushPermission = permission.receive;
  if (nativePushPermission !== 'granted') {
    permission = await plugin.requestPermissions();
    nativePushPermission = permission.receive;
  }
  if (nativePushPermission !== 'granted') {
    throw new Error(nativePushPermission === 'denied' ? 'permission-denied' : 'permission-dismissed');
  }
  const { FCM } = await import('@capacitor-community/fcm');
  await registerNativePush(() => FCM.setAutoInit({ enabled: true }));
}

function apiUrl(path) {
  if (!PUSH_NOTIFICATIONS_API_URL) throw new Error('not-configured');
  let base;
  try {
    base = new URL(PUSH_NOTIFICATIONS_API_URL);
  } catch {
    throw new Error('not-configured');
  }
  if (
    !['https:', 'http:'].includes(base.protocol)
    || base.username
    || base.password
    || (base.protocol === 'http:' && base.hostname !== 'localhost' && base.hostname !== '127.0.0.1')
  ) throw new Error('not-configured');
  return new URL(path, `${base.origin}/`).href;
}

async function request(path, { method = 'GET', body, credentials = activeCredentials } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (credentials) {
    headers.Authorization = `Bearer ${credentials.capability}`;
    headers['X-Aurora-Client'] = credentials.clientId;
  }
  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new Error('network');
  }
  let result = {};
  try {
    result = await response.json();
  } catch {
    if (response.ok) throw new Error('invalid-response');
  }
  if (!response.ok) throw new Error(result.error || 'request-failed');
  return result;
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function assertPushSupport() {
  if (
    !window.isSecureContext
    || !('serviceWorker' in navigator)
    || !('PushManager' in window)
    || !('Notification' in window)
  ) throw new Error('unsupported');
}

export function getPushNotificationStatus() {
  const native = typeof window !== 'undefined' && isNativeApp();
  const supported = native || (typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window);
  const enabled = activeCredentials?.enabled === true;
  const permission = native
    ? nativePushPermission
    : supported ? Notification.permission : 'unsupported';
  const configured = Boolean(PUSH_NOTIFICATIONS_API_URL && (!native || nativePushConfigured));
  let message = '';
  if (!PUSH_NOTIFICATIONS_API_URL) {
    message = 'O endereço do serviço de avisos ainda precisa ser configurado.';
  } else if (native && !nativePushConfigured) {
    message = 'O serviço de notificações nativas ainda precisa ser configurado.';
  } else if (!supported) {
    message = 'Avisos Push exigem um navegador compatível e uma origem HTTPS.';
  } else if (permission === 'denied') {
    message = native
      ? 'As notificações estão bloqueadas nas permissões do dispositivo.'
      : 'As notificações estão bloqueadas nas permissões do navegador.';
  } else if (!credentialStore) {
    message = 'Entre na sua conta para configurar avisos neste dispositivo.';
  } else if (enabled) {
    message = 'Avisos fora do app estão ativados para este dispositivo.';
  } else {
    message = 'Os avisos só serão ativados depois da sua autorização.';
  }
  return { configured, supported, enabled, permission, native, message };
}

export async function enablePushNotifications() {
  if (!credentialStore) throw new Error('account-storage');
  if (isNativeApp()) return enableNativePush();
  assertPushSupport();
  const permissionRequest = Notification.permission === 'default'
    ? Notification.requestPermission()
    : Promise.resolve(Notification.permission);
  const configRequest = request('/api/config');
  const [permission, config] = await Promise.all([permissionRequest, configRequest]);
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'permission-denied' : 'permission-dismissed');
  if (typeof config.publicKey !== 'string' || !/^[A-Za-z0-9_-]{80,100}$/.test(config.publicKey)) {
    throw new Error('invalid-config');
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) throw new Error('service-worker');
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(config.publicKey),
    });
  }
  const legacyCredentials = readLegacyCredentials();
  let credentials = await credentialStore.findPushSubscription(subscription.endpoint);
  if (!credentials && legacyCredentials) credentials = legacyCredentials;
  if (!credentials?.clientId || !credentials?.capability) {
    const created = await request('/api/clients', { method: 'POST', body: {} });
    credentials = { clientId: created.clientId, capability: created.capability, enabled: false };
  }
  const serializedSubscription = subscription.toJSON();
  await serializeMutation(async () => {
    await request('/api/subscription', {
      method: 'POST',
      credentials,
      body: { subscription: serializedSubscription },
    });
    try {
      activeCredentials = await credentialStore.savePushSubscription(credentials, serializedSubscription);
    } catch (error) {
      try {
        await request('/api/subscription', { method: 'DELETE', credentials });
      } catch (cleanupError) {
        console.error('Aurora: a inscrição Push não pôde ser revertida no serviço após falha do banco.', cleanupError);
      }
      try {
        await subscription.unsubscribe();
      } catch (cleanupError) {
        console.error('Aurora: não foi possível remover a inscrição local após falha do banco.', cleanupError);
      }
      activeCredentials = null;
      throw error;
    }
    if (legacyCredentials) removeLegacyCredentials();
  });
}

export async function disablePushNotifications() {
  const credentials = activeCredentials;
  if (isNativeApp()) {
    const plugin = await loadNativePushPlugin();
    const { FCM } = await import('@capacitor-community/fcm');
    await serializeMutation(async () => {
      if (credentials) await request('/api/subscription', { method: 'DELETE', credentials });
      if (credentials) await credentialStore.deletePushSubscription(credentials.clientId);
      await FCM.setAutoInit({ enabled: false });
      await FCM.deleteInstance();
      await plugin.unregister();
      activeCredentials = null;
    });
    return;
  }
  const registration = 'serviceWorker' in navigator
    ? await navigator.serviceWorker.getRegistration()
    : null;
  const subscription = registration?.pushManager
    ? await registration.pushManager.getSubscription()
    : null;
  await serializeMutation(async () => {
    if (credentials) await request('/api/subscription', { method: 'DELETE', credentials });
    if (subscription && !(await subscription.unsubscribe())) throw new Error('unsubscribe-failed');
    if (credentials) await credentialStore.deletePushSubscription(credentials.clientId);
    activeCredentials = null;
  });
}

export async function scheduleHabitPushReminders(reminders) {
  return serializeMutation(async () => {
    const credentials = activeCredentials;
    if (!credentials?.enabled) return false;
    if (!reminders.length) {
      await request('/api/habits', { method: 'DELETE', credentials });
      return false;
    }
    await request('/api/habits', { method: 'POST', credentials, body: { reminders } });
    return true;
  });
}

export async function cancelHabitPushReminders() {
  return serializeMutation(async () => {
    const credentials = activeCredentials;
    if (!credentials?.enabled) return false;
    await request('/api/habits', { method: 'DELETE', credentials });
    return true;
  });
}

export async function scheduleTaskPushReminders(reminders) {
  return serializeMutation(async () => {
    const credentials = activeCredentials;
    if (!credentials?.enabled) return false;
    if (!reminders.length) {
      await request('/api/tasks', { method: 'DELETE', credentials });
      return false;
    }
    await request('/api/tasks', { method: 'POST', credentials, body: { reminders } });
    return true;
  });
}

export async function cancelTaskPushReminders() {
  return serializeMutation(async () => {
    const credentials = activeCredentials;
    if (!credentials?.enabled) return false;
    await request('/api/tasks', { method: 'DELETE', credentials });
    return true;
  });
}

export function pushNotificationErrorMessage(error) {
  const messages = {
    'not-configured': 'O serviço de avisos não está configurado para esta instalação.',
    'account-storage': 'Entre na sua conta para guardar a inscrição Push com segurança.',
    'legacy-storage': 'Não foi possível ler a inscrição Push antiga. Ela foi preservada; tente novamente.',
    'legacy-invalid': 'A inscrição Push antiga está inválida e foi preservada. Desative-a manualmente no navegador antes de configurar outra.',
    'legacy-cleanup': 'A inscrição foi salva na conta, mas não foi possível remover a autorização antiga deste navegador.',
    unsupported: 'Este navegador ou contexto não permite notificações Push. Use HTTPS e um navegador compatível.',
    'native-not-configured': 'O serviço Firebase de notificações nativas ainda não está configurado.',
    'native-registration': 'Não foi possível registrar este dispositivo no serviço de notificações nativas.',
    network: 'Não foi possível conectar ao serviço de avisos. Confira a conexão e tente novamente.',
    'invalid-response': 'O serviço de avisos respondeu em um formato inválido.',
    'invalid-config': 'A chave pública de Push do serviço está inválida.',
    'permission-denied': 'Permissão negada. Altere as notificações nas configurações do navegador para tentar novamente.',
    'permission-dismissed': 'A permissão não foi concedida; nenhum aviso foi ativado.',
    'service-worker': 'O suporte offline do Aurora ainda não está pronto. Recarregue a página e tente novamente.',
    'unsubscribe-failed': 'O navegador não conseguiu remover a inscrição local.',
    'rate-limited': 'Muitas solicitações em pouco tempo. Aguarde um minuto e tente novamente.',
    'server-unavailable': 'O serviço de avisos está indisponível no momento.',
    'invalid-habit-reminders': 'Os dias, horários ou o fuso dos lembretes foram rejeitados pelo serviço.',
    'invalid-task-reminders': 'As datas ou horários dos lembretes de tarefa foram rejeitados pelo serviço.',
    'invalid-request': 'A solicitação enviada ao serviço de avisos foi rejeitada.',
    'invalid-subscription': 'A inscrição Push deste navegador foi rejeitada pelo serviço.',
    'subscription-required': 'Ative os avisos antes de configurar os lembretes.',
    unauthorized: 'A autorização deste dispositivo expirou. Desative e ative novamente os avisos.',
    cors: 'A origem desta página não está autorizada pelo serviço de avisos.',
    storage: 'Não foi possível atualizar a autorização local deste dispositivo.',
  };
  return messages[error?.message] || 'Não foi possível atualizar os avisos Push.';
}

if (typeof window !== 'undefined' && isNativeApp()) {
  void ensureNativePushListeners().catch((error) => {
    console.error('Aurora: não foi possível preparar os avisos nativos.', error);
  });
}
