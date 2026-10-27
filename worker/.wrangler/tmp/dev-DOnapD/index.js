var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/uint8array-extras/index.js
var objectToString = Object.prototype.toString;
var uint8ArrayStringified = "[object Uint8Array]";
var arrayBufferStringified = "[object ArrayBuffer]";
function isType(value, typeConstructor, typeStringified) {
  if (!value) {
    return false;
  }
  if (value.constructor === typeConstructor) {
    return true;
  }
  return objectToString.call(value) === typeStringified;
}
__name(isType, "isType");
function isUint8Array(value) {
  return isType(value, Uint8Array, uint8ArrayStringified);
}
__name(isUint8Array, "isUint8Array");
function isArrayBuffer(value) {
  return isType(value, ArrayBuffer, arrayBufferStringified);
}
__name(isArrayBuffer, "isArrayBuffer");
function isUint8ArrayOrArrayBuffer(value) {
  return isUint8Array(value) || isArrayBuffer(value);
}
__name(isUint8ArrayOrArrayBuffer, "isUint8ArrayOrArrayBuffer");
function toUint8ArrayIfArrayBuffer(value) {
  return isArrayBuffer(value) ? new Uint8Array(value) : value;
}
__name(toUint8ArrayIfArrayBuffer, "toUint8ArrayIfArrayBuffer");
function assertUint8ArrayOrArrayBuffer(value) {
  if (!isUint8ArrayOrArrayBuffer(value)) {
    throw new TypeError(`Expected \`Uint8Array\` or \`ArrayBuffer\`, got \`${typeof value}\``);
  }
}
__name(assertUint8ArrayOrArrayBuffer, "assertUint8ArrayOrArrayBuffer");
function toUint8Array(value) {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError(`Unsupported value, got \`${typeof value}\`.`);
}
__name(toUint8Array, "toUint8Array");
function concatUint8Arrays(arrays, totalLength) {
  if (arrays.length === 0) {
    return new Uint8Array(0);
  }
  totalLength ??= arrays.reduce((accumulator, currentValue) => accumulator + currentValue.byteLength, 0);
  const returnValue = new Uint8Array(totalLength);
  let offset = 0;
  for (let array of arrays) {
    assertUint8ArrayOrArrayBuffer(array);
    array = toUint8ArrayIfArrayBuffer(array);
    returnValue.set(array, offset);
    offset += array.length;
  }
  return returnValue;
}
__name(concatUint8Arrays, "concatUint8Arrays");
var cachedDecoders = {
  utf8: new globalThis.TextDecoder("utf8")
};
function assertString(value) {
  if (typeof value !== "string") {
    throw new TypeError(`Expected \`string\`, got \`${typeof value}\``);
  }
}
__name(assertString, "assertString");
var cachedEncoder = new globalThis.TextEncoder();
function stringToUint8Array(string) {
  assertString(string);
  return cachedEncoder.encode(string);
}
__name(stringToUint8Array, "stringToUint8Array");
function base64ToBase64Url(base64) {
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
__name(base64ToBase64Url, "base64ToBase64Url");
function base64UrlToBase64(base64url) {
  const base64 = base64url.replaceAll("-", "+").replaceAll("_", "/");
  const padding = (4 - base64.length % 4) % 4;
  return base64 + "=".repeat(padding);
}
__name(base64UrlToBase64, "base64UrlToBase64");
var MAX_BLOCK_SIZE = 65535;
function uint8ArrayToBase64(array, { urlSafe = false } = {}) {
  assertUint8ArrayOrArrayBuffer(array);
  array = toUint8ArrayIfArrayBuffer(array);
  let base64 = "";
  for (let index = 0; index < array.length; index += MAX_BLOCK_SIZE) {
    const chunk = array.subarray(index, index + MAX_BLOCK_SIZE);
    base64 += globalThis.btoa(String.fromCodePoint.apply(void 0, chunk));
  }
  return urlSafe ? base64ToBase64Url(base64) : base64;
}
__name(uint8ArrayToBase64, "uint8ArrayToBase64");
function base64ToUint8Array(base64String) {
  assertString(base64String);
  return Uint8Array.from(globalThis.atob(base64UrlToBase64(base64String)), (x) => x.codePointAt(0));
}
__name(base64ToUint8Array, "base64ToUint8Array");
var byteToHexLookupTable = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, "0"));

// node_modules/@block65/webcrypto-web-push/dist/lib/utils.js
function encodeRecordSize(size) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, size);
  return bytes;
}
__name(encodeRecordSize, "encodeRecordSize");
function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
__name(invariant, "invariant");

// node_modules/@block65/webcrypto-web-push/dist/lib/client-keys.js
async function deriveClientKeys(sub) {
  const bytes = base64ToUint8Array(sub.keys.p256dh);
  const authSecretBytes = base64ToUint8Array(sub.keys.auth);
  invariant(bytes.byteLength === 65 && bytes[0] === 4, "Subscription p256dh is not an uncompressed P-256 point");
  invariant(authSecretBytes.byteLength === 16, "Subscription auth secret is not 16 bytes");
  return {
    publicKeyBytes: bytes,
    publicKey: await crypto.subtle.importKey("raw", bytes, {
      name: "ECDH",
      namedCurve: "P-256"
    }, false, []),
    authSecretBytes
  };
}
__name(deriveClientKeys, "deriveClientKeys");

// node_modules/@block65/webcrypto-web-push/dist/lib/hkdf.js
function createHMAC(data) {
  const keyPromise = crypto.subtle.importKey("raw", data, {
    name: "HMAC",
    hash: "SHA-256"
  }, false, ["sign"]);
  return {
    hash: /* @__PURE__ */ __name(async (input) => {
      const k = await keyPromise;
      return crypto.subtle.sign("HMAC", k, input);
    }, "hash")
  };
}
__name(createHMAC, "createHMAC");
async function hkdf(salt, ikm) {
  const prkhPromise = createHMAC(salt).hash(ikm).then((prk) => createHMAC(prk));
  return {
    extract: /* @__PURE__ */ __name(async (info, len) => {
      const prkh = await prkhPromise;
      const blocks = await Array.from({ length: Math.ceil(len / 32) }, (_, i) => i).reduce(async (acc, i) => {
        const previous = await acc;
        const hash = await prkh.hash(new Uint8Array([...previous.at(-1) ?? [], ...info, i + 1]));
        return [...previous, new Uint8Array(hash)];
      }, Promise.resolve([]));
      return concatUint8Arrays(blocks).slice(0, len);
    }, "extract")
  };
}
__name(hkdf, "hkdf");

// node_modules/@block65/webcrypto-web-push/dist/lib/info.js
function createKeyInfo(clientPublic, serverPublic) {
  return new Uint8Array([
    ...stringToUint8Array("WebPush: info\0"),
    ...clientPublic,
    ...serverPublic
  ]);
}
__name(createKeyInfo, "createKeyInfo");
function createInfo(type) {
  return stringToUint8Array(`Content-Encoding: ${type}\0`);
}
__name(createInfo, "createInfo");

// node_modules/@block65/webcrypto-web-push/dist/lib/local-keys.js
async function generateLocalKeys() {
  const keyPair = await crypto.subtle.generateKey({
    name: "ECDH",
    namedCurve: "P-256"
  }, false, ["deriveBits"]);
  return {
    privateKey: keyPair.privateKey,
    publicKeyBytes: new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))
  };
}
__name(generateLocalKeys, "generateLocalKeys");

// node_modules/@block65/webcrypto-web-push/dist/lib/salt.js
async function getSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}
__name(getSalt, "getSalt");

// node_modules/@block65/webcrypto-web-push/dist/lib/encrypt.js
var recordSize = 4096;
var headerSize = 21 + 65;
var maxPlaintextSize = recordSize - headerSize - 17;
async function encryptNotification(subscription, plaintext, options = {}) {
  invariant(plaintext.byteLength <= maxPlaintextSize, `Payload is ${plaintext.byteLength} bytes, the maximum is ${maxPlaintextSize}`);
  const clientKeys = await deriveClientKeys(subscription);
  const salt = await getSalt();
  const localKeys = await generateLocalKeys();
  const sharedSecret = await crypto.subtle.deriveBits({
    name: "ECDH",
    public: clientKeys.publicKey
  }, localKeys.privateKey, 256);
  const keyInfo = createKeyInfo(clientKeys.publicKeyBytes, localKeys.publicKeyBytes);
  const cekInfo = createInfo("aes128gcm");
  const nonceInfo = createInfo("nonce");
  const ikmHkdf = await hkdf(clientKeys.authSecretBytes, sharedSecret);
  const ikm = await ikmHkdf.extract(keyInfo, 32);
  const messageHkdf = await hkdf(salt, ikm);
  const cekBytes = await messageHkdf.extract(cekInfo, 16);
  const nonceBytes = await messageHkdf.extract(nonceInfo, 12);
  const cekCryptoKey = await crypto.subtle.importKey("raw", cekBytes, {
    name: "AES-GCM",
    length: 128
  }, false, ["encrypt"]);
  const padTo = options.pad ?? true ? maxPlaintextSize : plaintext.byteLength;
  const padded = new Uint8Array(padTo + 1);
  padded.set(plaintext);
  padded[plaintext.byteLength] = 2;
  const encrypted = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv: nonceBytes
  }, cekCryptoKey, padded);
  return new Uint8Array([
    ...salt,
    ...encodeRecordSize(recordSize),
    localKeys.publicKeyBytes.byteLength,
    ...localKeys.publicKeyBytes,
    ...new Uint8Array(encrypted)
  ]);
}
__name(encryptNotification, "encryptNotification");

// node_modules/@block65/webcrypto-web-push/dist/lib/base64.js
function encodeBase64Url(value) {
  return uint8ArrayToBase64(toUint8Array(value), { urlSafe: true });
}
__name(encodeBase64Url, "encodeBase64Url");
function objectToBase64Url(obj) {
  return encodeBase64Url(stringToUint8Array(JSON.stringify(obj)));
}
__name(objectToBase64Url, "objectToBase64Url");

// node_modules/@block65/webcrypto-web-push/dist/lib/jwt.js
async function sign(payload, key) {
  const headerStr = objectToBase64Url({
    typ: "JWT",
    alg: "ES256"
  });
  const payloadStr = objectToBase64Url({
    iat: Math.floor(Date.now() / 1e3),
    ...payload
  });
  const dataStr = `${headerStr}.${payloadStr}`;
  const signature = await crypto.subtle.sign({
    name: "ECDSA",
    hash: "SHA-256"
  }, key, stringToUint8Array(dataStr));
  return `${dataStr}.${encodeBase64Url(signature)}`;
}
__name(sign, "sign");

// node_modules/@block65/webcrypto-web-push/dist/lib/vapid.js
async function vapidHeaders(subscription, vapid) {
  invariant(vapid.subject, "Vapid subject is empty");
  invariant(vapid.privateKey, "Vapid private key is empty");
  invariant(vapid.publicKey, "Vapid public key is empty");
  const endpoint = new URL(subscription.endpoint);
  invariant(endpoint.protocol === "https:", `Subscription endpoint is not https: ${endpoint.protocol}`);
  const vapidPublicKeyBytes = base64ToUint8Array(vapid.publicKey);
  const publicKey = await crypto.subtle.importKey("jwk", {
    kty: "EC",
    crv: "P-256",
    x: encodeBase64Url(vapidPublicKeyBytes.slice(1, 33)),
    y: encodeBase64Url(vapidPublicKeyBytes.slice(33, 65)),
    d: vapid.privateKey
  }, {
    name: "ECDSA",
    namedCurve: "P-256"
  }, false, ["sign"]);
  const jwt = await sign({
    aud: endpoint.origin,
    exp: Math.floor(Date.now() / 1e3) + 12 * 60 * 60,
    sub: vapid.subject
  }, publicKey);
  return {
    headers: {
      authorization: `vapid t=${jwt}, k=${vapid.publicKey}`
    }
  };
}
__name(vapidHeaders, "vapidHeaders");

// node_modules/@block65/webcrypto-web-push/dist/lib/payload.js
async function buildPushPayload(message, subscription, vapid) {
  const { headers } = await vapidHeaders(subscription, vapid);
  const body = await encryptNotification(subscription, stringToUint8Array(
    // if its a primitive, convert to string, otherwise stringify
    typeof message.data === "string" || typeof message.data === "number" ? message.data.toString() : JSON.stringify(message.data)
  ));
  return {
    headers: {
      ...headers,
      ttl: (message.options?.ttl || 60).toString(),
      ...message.options?.urgency && {
        urgency: message.options.urgency
      },
      ...message.options?.topic && {
        topic: message.options.topic
      },
      "content-encoding": "aes128gcm",
      "content-length": body.byteLength.toString(),
      "content-type": "application/octet-stream"
    },
    method: "post",
    body
  };
}
__name(buildPushPayload, "buildPushPayload");

// src/index.js
var API_PREFIX = "/api";
var MAX_BODY_BYTES = 16384;
var MAX_SCHEDULE_HORIZON_MS = 4 * 60 * 60 * 1e3;
var CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;
var TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;
var BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
var PHASES = /* @__PURE__ */ new Set(["focus", "short-break", "long-break"]);
var PUSH_HOSTS = [
  (hostname) => hostname === "web.push.apple.com" || hostname.endsWith(".push.apple.com"),
  (hostname) => hostname === "fcm.googleapis.com",
  (hostname) => hostname === "push.services.mozilla.com" || hostname.endsWith(".push.services.mozilla.com"),
  (hostname) => hostname.endsWith(".notify.windows.com")
];
var json = /* @__PURE__ */ __name((data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
}), "json");
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter((origin) => {
    try {
      const url = new URL(origin);
      return url.origin === origin && (url.protocol === "https:" || env.ENVIRONMENT === "development" && url.protocol === "http:" && url.hostname === "localhost");
    } catch {
      return false;
    }
  });
}
__name(allowedOrigins, "allowedOrigins");
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Aurora-Client",
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) return null;
  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > MAX_BODY_BYTES) return null;
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
__name(readJson, "readJson");
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
__name(isPlainObject, "isPlainObject");
function hasExactKeys(value, keys) {
  return isPlainObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
__name(hasExactKeys, "hasExactKeys");
function validEncodedBytes(value, expectedLength, prefix) {
  if (typeof value !== "string" || value.length > 128 || !BASE64URL_PATTERN.test(value)) return false;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (character) => character.charCodeAt(0));
    return bytes.length === expectedLength && (prefix === void 0 || bytes[0] === prefix);
  } catch {
    return false;
  }
}
__name(validEncodedBytes, "validEncodedBytes");
function validSchedule(value, now = Date.now()) {
  return hasExactKeys(value, ["phase", "phaseEndsAt", "focusMin", "breakMin", "longBreakMin", "completedPomodoros"]) && PHASES.has(value.phase) && Number.isSafeInteger(value.phaseEndsAt) && value.phaseEndsAt > now && value.phaseEndsAt <= now + MAX_SCHEDULE_HORIZON_MS && Number.isInteger(value.focusMin) && value.focusMin >= 5 && value.focusMin <= 120 && Number.isInteger(value.breakMin) && value.breakMin >= 1 && value.breakMin <= 60 && Number.isInteger(value.longBreakMin) && value.longBreakMin >= 5 && value.longBreakMin <= 60 && Number.isSafeInteger(value.completedPomodoros) && value.completedPomodoros >= 0 && value.completedPomodoros <= 1e6;
}
__name(validSchedule, "validSchedule");
function validSubscription(value) {
  if (!hasExactKeys(value, ["subscription"]) || !isPlainObject(value.subscription)) return false;
  const subscription = value.subscription;
  if (!hasExactKeys(subscription, ["endpoint", "expirationTime", "keys"])) return false;
  if (typeof subscription.endpoint !== "string" || subscription.endpoint.length > 2048) return false;
  let endpoint;
  try {
    endpoint = new URL(subscription.endpoint);
  } catch {
    return false;
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.port || !PUSH_HOSTS.some((isAllowed) => isAllowed(endpoint.hostname))) return false;
  if (subscription.expirationTime !== null && (!Number.isSafeInteger(subscription.expirationTime) || subscription.expirationTime <= Date.now())) return false;
  if (!hasExactKeys(subscription.keys, ["p256dh", "auth"])) return false;
  const { p256dh, auth } = subscription.keys;
  return validEncodedBytes(p256dh, 65, 4) && validEncodedBytes(auth, 16);
}
__name(validSubscription, "validSubscription");
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
function makeRandomToken(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(makeRandomToken, "makeRandomToken");
async function registerClient(env, request, headers) {
  if (request.method !== "POST") return json({ error: "method-not-allowed" }, 405, headers);
  const body = await readJson(request);
  if (!hasExactKeys(body, [])) return json({ error: "invalid-request" }, 400, headers);
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return json({ error: "server-unavailable" }, 503, headers);
  if (env.REGISTER_RATE_LIMIT) {
    try {
      const { success } = await env.REGISTER_RATE_LIMIT.limit({ key: ip });
      if (!success) return json({ error: "rate-limited" }, 429, headers);
    } catch {
      return json({ error: "server-unavailable" }, 503, headers);
    }
  } else if (env.ENVIRONMENT !== "development") {
    return json({ error: "server-unavailable" }, 503, headers);
  }
  const clientId = makeRandomToken(24);
  const capability = makeRandomToken(32);
  let provisioned;
  try {
    const stub = env.POMODORO_ALARMS.get(env.POMODORO_ALARMS.idFromName(clientId));
    provisioned = await stub.fetch("https://internal/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authHash: await sha256(capability) })
    });
  } catch {
    return json({ error: "server-unavailable" }, 503, headers);
  }
  if (!provisioned.ok) return json({ error: "server-unavailable" }, 503, headers);
  return json({ clientId, capability }, 201, headers);
}
__name(registerClient, "registerClient");
async function dispatchClientOperation(env, request, headers, operation, body) {
  const clientId = request.headers.get("X-Aurora-Client") || "";
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!CLIENT_ID_PATTERN.test(clientId) || !TOKEN_PATTERN.test(token)) {
    return json({ error: "unauthorized" }, 401, headers);
  }
  if (operation === "subscribe" && !validSubscription(body)) {
    return json({ error: "invalid-subscription" }, 400, headers);
  }
  if (operation === "schedule" && request.method === "POST" && !validSchedule(body)) {
    return json({ error: "schedule-horizon" }, 400, headers);
  }
  if (!["subscribe", "unsubscribe", "schedule", "cancel"].includes(operation)) {
    return json({ error: "not-found" }, 404, headers);
  }
  if (env.API_RATE_LIMIT) {
    try {
      const { success } = await env.API_RATE_LIMIT.limit({ key: clientId });
      if (!success) return json({ error: "rate-limited" }, 429, headers);
    } catch {
      return json({ error: "server-unavailable" }, 503, headers);
    }
  } else if (env.ENVIRONMENT !== "development") {
    return json({ error: "server-unavailable" }, 503, headers);
  }
  let response;
  try {
    const stub = env.POMODORO_ALARMS.get(env.POMODORO_ALARMS.idFromName(clientId));
    const internal = new Request(`https://internal/${operation}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Aurora-Client": clientId
      },
      body: JSON.stringify(body || {})
    });
    response = await stub.fetch(internal);
  } catch {
    return json({ error: "server-unavailable" }, 503, headers);
  }
  let result;
  try {
    result = await readJson(response);
  } catch {
    return json({ error: "server-unavailable" }, 503, headers);
  }
  return json(result || { error: "server-unavailable" }, response.status, headers);
}
__name(dispatchClientOperation, "dispatchClientOperation");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const origins = allowedOrigins(env);
    if (!origin || !origins.includes(origin)) return json({ error: "cors" }, 403);
    const headers = corsHeaders(origin);
    if (!url.pathname.startsWith(`${API_PREFIX}/`)) return json({ error: "not-found" }, 404, headers);
    if (url.search) return json({ error: "invalid-request" }, 400, headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname === `${API_PREFIX}/config`) {
      if (request.method !== "GET") return json({ error: "method-not-allowed" }, 405, headers);
      if (!validEncodedBytes(env.VAPID_PUBLIC_KEY, 65, 4)) {
        return json({ error: "server-unavailable" }, 503, headers);
      }
      return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, headers);
    }
    if (url.pathname === `${API_PREFIX}/clients`) {
      return registerClient(env, request, headers);
    }
    const path = url.pathname;
    if (path === `${API_PREFIX}/subscription`) {
      if (request.method === "POST") {
        const body = await readJson(request);
        if (!body) return json({ error: "invalid-request" }, 400, headers);
        return dispatchClientOperation(env, request, headers, "subscribe", body);
      }
      if (request.method === "DELETE") {
        if (request.body) return json({ error: "invalid-request" }, 400, headers);
        return dispatchClientOperation(env, request, headers, "unsubscribe", {});
      }
    }
    if (path === `${API_PREFIX}/schedule`) {
      if (request.method === "POST") {
        const body = await readJson(request);
        if (!body) return json({ error: "invalid-request" }, 400, headers);
        return dispatchClientOperation(env, request, headers, "schedule", body);
      }
      if (request.method === "DELETE") {
        if (request.body) return json({ error: "invalid-request" }, 400, headers);
        return dispatchClientOperation(env, request, headers, "cancel", {});
      }
    }
    return json({ error: "not-found" }, 404, headers);
  }
};
function validStoredSchedule(value) {
  return isPlainObject(value) && PHASES.has(value.phase) && Number.isSafeInteger(value.phaseEndsAt) && Number.isInteger(value.focusMin) && Number.isInteger(value.breakMin) && Number.isInteger(value.longBreakMin) && Number.isSafeInteger(value.completedPomodoros);
}
__name(validStoredSchedule, "validStoredSchedule");
function phaseDurationMs(schedule, phase) {
  const minutes = phase === "focus" ? schedule.focusMin : phase === "long-break" ? schedule.longBreakMin : schedule.breakMin;
  return minutes * 6e4;
}
__name(phaseDurationMs, "phaseDurationMs");
function transition(schedule) {
  let completedPomodoros = schedule.completedPomodoros;
  let phase;
  if (schedule.phase === "focus") {
    completedPomodoros += 1;
    phase = completedPomodoros % 4 === 0 ? "long-break" : "short-break";
  } else {
    phase = "focus";
  }
  return {
    ...schedule,
    phase,
    completedPomodoros,
    phaseEndsAt: schedule.phaseEndsAt + phaseDurationMs(schedule, phase)
  };
}
__name(transition, "transition");
function notificationFor(phase) {
  if (phase === "focus") {
    return { title: "Aurora \xB7 Pomodoro", body: "A pausa terminou. Hora de retomar o foco." };
  }
  if (phase === "long-break") {
    return { title: "Aurora \xB7 Pomodoro", body: "Quarto bloco conclu\xEDdo. Hora da pausa longa." };
  }
  return { title: "Aurora \xB7 Pomodoro", body: "Bloco de foco conclu\xEDdo. Hora da pausa curta." };
}
__name(notificationFor, "notificationFor");
function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
__name(constantTimeEqual, "constantTimeEqual");
var PomodoroAlarm = class {
  static {
    __name(this, "PomodoroAlarm");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }
  async authenticate(request) {
    const savedHash = await this.storage.get("authHash");
    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!savedHash || !TOKEN_PATTERN.test(token)) return false;
    return constantTimeEqual(savedHash, await sha256(token));
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/provision" && request.method === "POST") {
      if (await this.storage.get("authHash")) return json({ error: "already-provisioned" }, 409);
      const body = await readJson(request);
      if (!hasExactKeys(body, ["authHash"]) || !/^[a-f0-9]{64}$/.test(body.authHash)) {
        return json({ error: "invalid-request" }, 400);
      }
      await this.storage.put("authHash", body.authHash);
      return json({ ok: true }, 201);
    }
    if (!await this.authenticate(request)) return json({ error: "unauthorized" }, 401);
    if (path === "/subscribe" && request.method === "POST") {
      const body = await readJson(request);
      if (!validSubscription(body)) return json({ error: "invalid-subscription" }, 400);
      await this.storage.put("subscription", body.subscription);
      return json({ ok: true });
    }
    if (path === "/unsubscribe" && request.method === "POST") {
      await this.storage.delete(["subscription", "schedule"]);
      await this.state.storage.deleteAlarm();
      return json({ ok: true });
    }
    if (path === "/schedule" && request.method === "POST") {
      const body = await readJson(request);
      if (!validSchedule(body)) return json({ error: "schedule-horizon" }, 400);
      if (!await this.storage.get("subscription")) return json({ error: "subscription-required" }, 409);
      await this.storage.put("schedule", body);
      await this.state.storage.setAlarm(body.phaseEndsAt);
      return json({ ok: true, scheduledAt: body.phaseEndsAt });
    }
    if (path === "/cancel" && request.method === "POST") {
      await this.storage.delete("schedule");
      await this.state.storage.deleteAlarm();
      return json({ ok: true });
    }
    return json({ error: "not-found" }, 404);
  }
  async alarm() {
    let schedule = await this.storage.get("schedule");
    const subscription = await this.storage.get("subscription");
    if (!validStoredSchedule(schedule) || !subscription) {
      await this.storage.delete("schedule");
      await this.state.storage.deleteAlarm();
      return;
    }
    let transitions = 0;
    const now = Date.now();
    while (schedule.phaseEndsAt <= now && transitions < 512) {
      schedule = transition(schedule);
      transitions += 1;
    }
    if (transitions >= 512) {
      await this.storage.delete("schedule");
      await this.state.storage.deleteAlarm();
      return;
    }
    await this.storage.put("schedule", schedule);
    await this.state.storage.setAlarm(schedule.phaseEndsAt);
    if (!transitions) return;
    const notification = notificationFor(schedule.phase);
    try {
      const payload = await buildPushPayload({
        data: JSON.stringify(notification),
        options: { ttl: 3600, urgency: "normal" }
      }, subscription, {
        subject: this.env.VAPID_SUBJECT,
        publicKey: this.env.VAPID_PUBLIC_KEY,
        privateKey: this.env.VAPID_PRIVATE_KEY
      });
      const response = await fetch(subscription.endpoint, payload);
      if (response.status === 404 || response.status === 410 || response.status === 400) {
        await this.storage.delete(["subscription", "schedule"]);
        await this.state.storage.deleteAlarm();
      } else if (!response.ok) {
        console.warn(`Push do Pomodoro rejeitado pelo servi\xE7o (${response.status}).`);
      }
    } catch {
      console.warn("N\xE3o foi poss\xEDvel enviar um aviso Push do Pomodoro.");
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-tHNUZE/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-tHNUZE/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  PomodoroAlarm,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
