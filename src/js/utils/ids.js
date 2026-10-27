export const newId = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : `id-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
