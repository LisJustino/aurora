export function parseAllowedOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => {
      try {
        const url = new URL(origin);
        return url.origin === origin
          && !url.hostname.includes('*')
          && url.protocol === 'https:';
      } catch {
        return false;
      }
    });
}
