const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://localhost:5173';
const landingPreviews = ['hoje', 'tarefas', 'financas', 'habitos', 'ciclo'];
const MAX_PREVIEW_BYTES = 180_000;

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(base);

    for (const id of landingPreviews) {
      for (const suffix of ['', '-dark']) {
        const previewUrl = `/src/assets/tutorials/landing/${id}${suffix}.webp`;
        const response = await page.request.get(new URL(previewUrl, base).href);
        assert.equal(response.status(), 200, `${id}${suffix}: preview request failed`);
        assert.match(response.headers()['content-type'], /image\/webp/i, `${id}${suffix}: preview is not WebP`);
        const bytes = await response.body();
        assert.ok(bytes.length <= MAX_PREVIEW_BYTES, `${id}${suffix}: preview exceeds the size limit`);
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
        assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      }
      console.log(`OK — landing/${id} light & dark WebP previews verified`);
    }

    await page.goto(`${base}/?preview#inicio`);
    await page.locator('.area-guide-button').waitFor({ state: 'visible', timeout: 45_000 });
    await page.locator('.area-guide-button').click();
    await page.locator('.area-guide-tabs').waitFor({ state: 'visible' });
    assert.ok((await page.locator('.area-guide-card').count()) >= 4, 'guide renders feature cards');
    await page.locator('.area-guide-tab[data-area-guide="habitos"]').click();
    await page.locator('#dt').waitFor({ state: 'visible' });
    assert.match(await page.locator('#dt').innerText(), /Hábitos/i);
    console.log('OK — interactive area guide modal and tabs verified');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
