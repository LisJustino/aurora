import { phaseDurationSeconds, phaseElapsedSeconds } from '../features/studies/pomodoro.js';
import { POMODORO_PUSH_API_URL } from './pomodoro-push-config.js';

const STORAGE_KEY = 'aurora.push.pomodoro';
let mutationQueue = Promise.resolve();

function serializeMutation(operation) {
  const pending = mutationQueue.catch(() => {}).then(operation);
  mutationQueue = pending.catch(() => {});
  return pending;
}

function readCredentials() {
  let value;
  try {
    value = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error('storage');
  }
  try {
    const stored = JSON.parse(value || 'null');
    if (
      stored
      && typeof stored.clientId === 'string'
      && typeof stored.capability === 'string'
      && stored.clientId.length <= 64
      && stored.capability.length <= 128
    ) return stored;
  } catch {
    return null;
  }
  return null;
}

function saveCredentials(credentials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

function apiUrl(path) {
  if (!POMODORO_PUSH_API_URL) throw new Error('not-configured');
  let base;
  try {
    base = new URL(POMODORO_PUSH_API_URL);
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

async function request(path, { method = 'GET', body, credentials = readCredentials() } = {}) {
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

export function getPomodoroPushStatus() {
  const supported = typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
  let enabled = false;
  let storageFailed = false;
  try {
    enabled = readCredentials()?.enabled === true;
  } catch {
    storageFailed = true;
  }
  const permission = supported ? Notification.permission : 'unsupported';
  let message = '';
  if (!POMODORO_PUSH_API_URL) {
    message = 'O endereço do serviço de avisos ainda precisa ser configurado.';
  } else if (!supported) {
    message = 'Avisos Push exigem um navegador compatível e uma origem HTTPS.';
  } else if (permission === 'denied') {
    message = 'As notificações estão bloqueadas nas permissões do navegador.';
  } else if (storageFailed) {
    message = 'Não foi possível acessar o armazenamento local desta instalação.';
  } else if (enabled) {
    message = 'Avisos fora do app estão ativados para este dispositivo.';
  } else {
    message = 'Os avisos só serão ativados depois da sua autorização.';
  }
  return { configured: Boolean(POMODORO_PUSH_API_URL), supported, enabled, permission, message };
}

export function createPomodoroSchedule(timer, pomodoro, now = Date.now()) {
  if (!timer || timer.startedAt === null) return null;
  const durationSeconds = phaseDurationSeconds(pomodoro, timer.phase);
  const remainingSeconds = Math.max(0, durationSeconds - phaseElapsedSeconds(timer, now));
  return {
    phase: timer.phase,
    phaseEndsAt: now + remainingSeconds * 1000,
    focusMin: pomodoro.focusMin,
    breakMin: pomodoro.breakMin,
    longBreakMin: pomodoro.longBreakMin,
    completedPomodoros: timer.completedPomodoros,
  };
}

export async function enablePomodoroPush() {
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
  let credentials = readCredentials();
  if (!credentials?.clientId || !credentials?.capability) {
    const created = await request('/api/clients', { method: 'POST', body: {} });
    credentials = { clientId: created.clientId, capability: created.capability, enabled: false };
    saveCredentials(credentials);
  }
  await serializeMutation(() => request('/api/subscription', {
    method: 'POST',
    credentials,
    body: { subscription: subscription.toJSON() },
  }));
  credentials = { ...credentials, enabled: true };
  saveCredentials(credentials);
}

export async function disablePomodoroPush() {
  const credentials = readCredentials();
  const registration = 'serviceWorker' in navigator
    ? await navigator.serviceWorker.getRegistration()
    : null;
  const subscription = registration?.pushManager
    ? await registration.pushManager.getSubscription()
    : null;
  await serializeMutation(async () => {
    if (credentials) await request('/api/subscription', { method: 'DELETE', credentials });
    if (subscription && !(await subscription.unsubscribe())) throw new Error('unsubscribe-failed');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      throw new Error('storage');
    }
  });
}

export async function schedulePomodoroPush(timer, pomodoro) {
  return serializeMutation(async () => {
    const credentials = readCredentials();
    if (!credentials?.enabled) return false;
    const schedule = createPomodoroSchedule(timer, pomodoro);
    if (!schedule) {
      await request('/api/schedule', { method: 'DELETE', credentials });
      return false;
    }
    await request('/api/schedule', { method: 'POST', credentials, body: schedule });
    return true;
  });
}

export async function cancelPomodoroPushSchedule() {
  return serializeMutation(async () => {
    const credentials = readCredentials();
    if (!credentials?.enabled) return false;
    await request('/api/schedule', { method: 'DELETE', credentials });
    return true;
  });
}

export function pomodoroPushErrorMessage(error) {
  const messages = {
    'not-configured': 'O serviço de avisos não está configurado para esta instalação.',
    unsupported: 'Este navegador ou contexto não permite notificações Push. Use HTTPS e um navegador compatível.',
    network: 'Não foi possível conectar ao serviço de avisos. Confira a conexão e tente novamente.',
    'invalid-response': 'O serviço de avisos respondeu em um formato inválido.',
    'invalid-config': 'A chave pública de Push do serviço está inválida.',
    'permission-denied': 'Permissão negada. Altere as notificações nas configurações do navegador para tentar novamente.',
    'permission-dismissed': 'A permissão não foi concedida; nenhum aviso foi ativado.',
    'service-worker': 'O suporte offline do Aurora ainda não está pronto. Recarregue a página e tente novamente.',
    'unsubscribe-failed': 'O navegador não conseguiu remover a inscrição local.',
    'rate-limited': 'Muitas solicitações em pouco tempo. Aguarde um minuto e tente novamente.',
    'server-unavailable': 'O serviço de avisos está indisponível no momento.',
    'schedule-horizon': 'A próxima fase está fora do limite de agendamento permitido.',
    'invalid-request': 'A solicitação enviada ao serviço de avisos foi rejeitada.',
    'invalid-subscription': 'A inscrição Push deste navegador foi rejeitada pelo serviço.',
    'subscription-required': 'Ative os avisos antes de agendar as mudanças de fase.',
    unauthorized: 'A autorização deste dispositivo expirou. Desative e ative novamente os avisos.',
    cors: 'A origem desta página não está autorizada pelo serviço de avisos.',
    storage: 'Não foi possível atualizar a autorização local deste dispositivo.',
  };
  return messages[error?.message] || 'Não foi possível atualizar os avisos Push. O estado do timer não foi revertido.';
}
