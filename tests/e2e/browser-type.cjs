const { chromium, firefox, webkit } = require('playwright');

const browserTypes = { chromium, firefox, webkit };
const browserName = process.env.PLAYWRIGHT_BROWSER || 'chromium';
const browserType = browserTypes[browserName];

if (!browserType) {
  throw new Error(`Navegador Playwright desconhecido: ${browserName}.`);
}

module.exports = { browserType };
