const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');

const viewports = [
  ['iPhone 12', { ...devices['iPhone 12'] }],
  ['iPhone 12 landscape', { ...devices['iPhone 12'], viewport: { width: 844, height: 390 } }],
  ['compact mobile', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1280, height: 900 } }],
];

async function checkLegalDialog(page, label) {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(process.argv[2] || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.locator('[data-legal-document="terms"]').first().click();
  await page.waitForSelector('dialog[data-legal-modal][open] .legal-document');

  const layout = await page.locator('dialog[data-legal-modal]').evaluate((dialog) => {
    const rect = dialog.getBoundingClientRect();
    const content = dialog.querySelector('.legal-modal-content');
    const footer = dialog.querySelector('.legal-modal-footer').getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      dialog: [Math.round(rect.top), Math.round(rect.bottom)],
      footer: [Math.round(footer.top), Math.round(footer.bottom)],
      content: [content.clientHeight, content.scrollHeight],
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  assert(layout.dialog[0] >= 0 && layout.dialog[1] <= layout.viewport[1], `${label}: modal ultrapassa a tela`);
  assert(layout.footer[0] >= layout.dialog[0] && layout.footer[1] <= layout.dialog[1], `${label}: rodapé cortado`);
  assert(layout.content[1] > layout.content[0], `${label}: documento não está rolável`);
  assert(layout.scrollWidth <= layout.viewport[0], `${label}: overflow horizontal`);
  assert.deepEqual(pageErrors, [], `${label}: erros JavaScript`);
  console.log(`${label}: layout aprovado`, layout);
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [label, contextOptions] of viewports) {
      const context = await browser.newContext(contextOptions);
      try {
        await checkLegalDialog(await context.newPage(), label);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
