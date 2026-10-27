export function readStorage(key) {
  return JSON.parse(window.localStorage.getItem(key) || 'null');
}

export function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorage(key) {
  window.localStorage.removeItem(key);
}
