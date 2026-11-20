const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5173';
const ids = ['inicio', 'planejar', 'financas', 'habitos', 'ciclo'];
const MAX_POSTER_BYTES = 180_000;
const MAX_VIDEO_BYTES = 6_000_000;

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(base);

    for (const id of ids) {
      const posterUrl = `/src/assets/tutorials/${id}.webp`;
      const videoUrl = `/src/assets/tutorials/${id}.mp4`;
      const poster = await page.request.get(new URL(posterUrl, base).href);
      assert.equal(poster.status(), 200, `${id}: poster request failed`);
      assert.match(poster.headers()['content-type'], /image\/webp/i, `${id}: poster is not WebP`);
      const posterBytes = await poster.body();
      assert.ok(posterBytes.length <= MAX_POSTER_BYTES, `${id}: poster exceeds the size limit`);
      assert.equal(posterBytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(posterBytes.toString('ascii', 8, 12), 'WEBP');
      const posterDimensions = await page.evaluate(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        return { width: image.naturalWidth, height: image.naturalHeight };
      }, posterUrl);
      assert.deepEqual(posterDimensions, { width: 1280, height: 720 }, `${id}: poster dimensions mismatch`);

      const videoResponse = await page.request.get(new URL(videoUrl, base).href);
      assert.equal(videoResponse.status(), 200, `${id}: MP4 request failed`);
      assert.ok((await videoResponse.body()).length <= MAX_VIDEO_BYTES, `${id}: MP4 exceeds the size limit`);

      const media = await page.evaluate(async (src) => {
        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'auto';
        const canPlayH264 = video.canPlayType('video/mp4; codecs="avc1.42E01E"');
        const source = document.createElement('source');
        source.src = src;
        source.type = 'video/mp4';
        video.append(source);
        document.body.append(video);
        const wait = (event) => new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 15_000);
          video.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
          video.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Media playback failed')); }, { once: true });
        });
        try {
          if (!canPlayH264) throw new Error('Browser does not report H.264 MP4 support');
          const metadata = wait('loadedmetadata');
          video.load();
          await metadata;
          if (!Number.isFinite(video.duration) || video.duration <= 2) throw new Error('Invalid video duration');
          if (video.videoWidth !== 1280 || video.videoHeight !== 720) throw new Error('Invalid video dimensions');
          const seeked = wait('seeked');
          video.currentTime = video.duration / 2;
          await seeked;
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
              reject(new Error('Playback stalled'));
            }, 10_000);
          });
          return { src: video.currentSrc, duration: video.duration };
        } finally {
          video.pause();
          video.remove();
        }
      }, videoUrl);
      assert.ok(media.src.endsWith('.mp4'), `${id}: unexpected source ${media.src}`);
      console.log(`OK — ${id}: 1280x720 poster, H.264 MP4 metadata, seek and playback`);
    }

    await page.goto(`${base}/?preview#inicio`);
    await page.locator('.area-guide-button').waitFor({ state: 'visible', timeout: 45_000 });
    await page.locator('.area-guide-button').click();
    const modalVideo = page.locator('.area-tutorial-video');
    await modalVideo.waitFor({ state: 'visible' });
    assert.ok((await modalVideo.getAttribute('poster')).endsWith('/src/assets/tutorials/inicio.webp'));
    assert.equal(await modalVideo.getAttribute('width'), '1280');
    assert.equal(await modalVideo.getAttribute('height'), '720');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
