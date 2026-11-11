const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5173';
const ids = ['inicio', 'planejar', 'financas', 'habitos', 'ciclo'];

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(base);
    for (const id of ids) {
      for (const fallback of [false, true]) {
        const result = await page.evaluate(async ({ id: area, fallback: useFallback }) => {
          const video = document.createElement('video');
          video.muted = true;
          video.preload = 'auto';
          for (const [format, type] of [['mp4', useFallback ? 'video/x-unsupported' : 'video/mp4'], ['webm', 'video/webm']]) {
            const source = document.createElement('source');
            source.src = `/src/assets/tutorials/${area}.${format}`;
            source.type = type;
            video.append(source);
          }
          document.body.append(video);
          const wait = (event) => new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event} on ${area}`)), 15_000);
            video.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
            video.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`Media error on ${area}`)); }, { once: true });
          });
          try {
            const metadata = wait('loadedmetadata');
            video.load();
            await metadata;
            if (!Number.isFinite(video.duration) || video.duration <= 2) throw new Error(`Invalid duration for ${area}`);
            const seek = wait('seeked');
            video.currentTime = video.duration / 2;
            await seek;
            const start = video.currentTime;
            await video.play();
            await new Promise((resolve, reject) => {
              const interval = setInterval(() => {
                if (video.currentTime > start + 0.1) {
                  clearTimeout(timeout);
                  clearInterval(interval);
                  resolve();
                }
              }, 50);
              const timeout = setTimeout(() => {
                clearInterval(interval);
                reject(new Error(`Playback stalled for ${area}`));
              }, 10_000);
            });
            return { src: video.currentSrc, duration: video.duration };
          } finally {
            video.pause();
            video.remove();
          }
        }, { id, fallback });
        assert.ok(result.src.endsWith(`.${fallback ? 'webm' : 'mp4'}`), `unexpected source: ${result.src}`);
        console.log(`OK — ${id} ${fallback ? 'WebM fallback' : 'MP4'}: metadata, seek and playback`);
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
