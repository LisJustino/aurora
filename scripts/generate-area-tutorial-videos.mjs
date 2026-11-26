import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { AREA_GUIDES } from '../src/js/features/area-guides.js';

const rootDirectory = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = process.env.AURORA_TUTORIAL_OUTPUT_DIR
  ? resolve(process.env.AURORA_TUTORIAL_OUTPUT_DIR)
  : join(rootDirectory, 'src', 'assets', 'tutorials');
const VIDEO_FRAME_RATE = 30;
const VIDEO_BITRATE = 6_000_000;
const MOBILE_MODE = process.env.AURORA_TUTORIAL_MOBILE === '1';
const MOBILE_SUFFIX = MOBILE_MODE ? '-mobile' : '';
const VIDEO_WIDTH = MOBILE_MODE ? 780 : 1280;
const VIDEO_HEIGHT = MOBILE_MODE ? 1688 : 720;
const APP_VIEWPORT_WIDTH = MOBILE_MODE ? 390 : VIDEO_WIDTH;
const APP_VIEWPORT_HEIGHT = MOBILE_MODE ? 844 : VIDEO_HEIGHT;
const MAX_POSTER_BYTES = 180_000;
const FOCUS_SAFE_MARGIN = MOBILE_MODE ? 16 : 32;
const FOCUS_HORIZONTAL_MARGIN = MOBILE_MODE ? 8 : 16;
const CAPTION_HEIGHT = MOBILE_MODE ? 320 : 176;
const focusSteps = {
  inicio: ['.home-today-card > .head', '.home-head-actions', '.header-account-trigger:visible, .profile-link:visible'],
  planejar: [
    '.plan-view-segments',
    { open: '[data-action="plan-view"][data-v="calendario"]', target: '[data-action="plan-view"][data-v="calendario"]' },
    { open: '[data-action="plan-view"][data-v="lista"]', target: '.grp .gh' },
    '.task',
  ],
  financas: [
    { open: '[data-action="fin-tab"][data-t="contas"]', target: '.fin-section-content .acc' },
    { open: '[data-action="fin-tab"][data-t="resumo"]', target: '.fin-hero-actions [data-action="tx-new"]' },
    { open: '.fin-hero-actions [data-action="tx-new"]', target: '.finance-transaction-type' },
    { close: true, open: '[data-action="fin-tab"][data-t="relatorios"]', target: '.fin-section-content .card svg' },
  ],
  habitos: [
    '.habit-today',
    '[data-action="habit-new"]',
    { open: '.habit-ideas > summary', target: '.habit-ideas > summary' },
    { open: '[data-action="habit-ideas-expand"]', target: '[data-habit-idea][data-id="water"]' },
  ],
  ciclo: ['.cycle-day-entry', '.cycle-calendar-card .cal', '.cycle-overview'],
};
async function copyTutorialOutput(source, destination) {
  const retryableErrors = new Set(['EACCES', 'EBUSY', 'EPERM', 'UNKNOWN']);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await copyFile(source, destination);
      return;
    } catch (error) {
      if (!retryableErrors.has(error.code) || attempt === 4) throw error;
      console.warn(`Retrying tutorial output after ${error.code} (${attempt + 1}/4).`);
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 400));
    }
  }
}
const entries = Object.entries(AREA_GUIDES);
const requestedId = process.argv[2];
const guides = requestedId ? entries.filter(([id]) => id === requestedId) : entries;
if (requestedId && !guides.length) throw new Error(`Unknown area tutorial: ${requestedId}`);

if (!requestedId) {
  for (const [id] of guides) {
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), id], {
      cwd: rootDirectory,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Tutorial generation failed for ${id} with status ${result.status}.`);
  }
  process.exit(0);
}

await mkdir(outputDirectory, { recursive: true });
const tempDirectory = await mkdtemp(join(tmpdir(), 'aurora-tutorials-'));
const server = await createServer({
  configFile: join(rootDirectory, 'vite.config.js'),
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
});
let browser;
let context;
try {
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine the local tutorial server address.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    acceptDownloads: true,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: { width: APP_VIEWPORT_WIDTH, height: APP_VIEWPORT_HEIGHT },
  });
  const appPage = await context.newPage();
  const videoPage = await context.newPage();
  const pageErrors = [];
  appPage.on('pageerror', (error) => pageErrors.push(error));
  videoPage.on('pageerror', (error) => pageErrors.push(error));
  await videoPage.goto(`${baseUrl}/terms.html`);
  await videoPage.setContent(`<!doctype html><html lang="pt-BR"><head><style>@font-face{font-family:"Figtree";src:url("/src/fonts/figtree-latin.woff2") format("woff2");font-weight:400 700}@font-face{font-family:"Newsreader";src:url("/src/fonts/newsreader-latin.woff2") format("woff2");font-weight:400 700}</style></head><body></body></html>`);
  await videoPage.evaluate(() => Promise.all([document.fonts.load('400 20px "Figtree"'), document.fonts.load('500 34px "Newsreader"')]));

  for (const [id, guide] of guides) {
    const fileId = `${id}${MOBILE_SUFFIX}`;
    const steps = focusSteps[id];
    if (!steps || steps.length !== guide.steps.length) {
      throw new Error(`Tutorial ${id} is missing one or more matching screen highlights.`);
    }

    await appPage.goto(`${baseUrl}/?preview#${id}`);
    await appPage.waitForFunction(
      (route) => document.querySelector('.main')?.dataset.route === route,
      id,
      { timeout: 45_000 },
    );
    await appPage.locator('.area-guide-button').waitFor({ state: 'visible', timeout: 45_000 });
    await appPage.evaluate(() => document.fonts.ready);
    const accent = await appPage.evaluate(() => {
      const sample = document.createElement('span');
      sample.style.color = 'var(--accent)';
      document.documentElement.append(sample);
      const color = getComputedStyle(sample).color;
      sample.remove();
      return color;
    });
    const capture = async (selector) => {
      const locator = selector ? appPage.locator(selector).first() : appPage.locator('.main');
      if (!await locator.count()) throw new Error(`Tutorial ${id} could not find screen target: ${selector}`);
      await locator.scrollIntoViewIfNeeded();
      await appPage.waitForTimeout(150);
      const rect = await locator.evaluate((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      });
      if (selector !== '.main' && rect.height <= APP_VIEWPORT_HEIGHT - FOCUS_SAFE_MARGIN * 2) {
        await locator.evaluate((element, margin) => {
          const bounds = element.getBoundingClientRect();
          const offset = bounds.top < margin
            ? bounds.top - margin - 4
            : bounds.bottom > innerHeight - margin
              ? bounds.bottom - (innerHeight - margin) + 4
              : 0;
          if (offset) window.scrollBy(0, offset);
        }, FOCUS_SAFE_MARGIN);
      }
      const focus = await locator.evaluate((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      });
      if (selector !== '.main' && (
        focus.x < FOCUS_HORIZONTAL_MARGIN
        || focus.x + focus.width > APP_VIEWPORT_WIDTH - FOCUS_HORIZONTAL_MARGIN
        || focus.y < (MOBILE_MODE ? 4 : 8)
        || focus.y + focus.height > APP_VIEWPORT_HEIGHT - FOCUS_SAFE_MARGIN
      )) {
        throw new Error(`Tutorial ${id} target ${selector} does not fit inside the video frame: ${JSON.stringify(focus)}.`);
      }
      return {
        image: (await appPage.screenshot({ type: 'png' })).toString('base64'),
        focus,
      };
    };

    const titleScreen = await capture('.main');
    const stepScreens = [];
    for (const step of steps) {
      if (typeof step === 'object') {
        if (step.close) await appPage.keyboard.press('Escape');
        if (step.select) await appPage.locator(step.select).selectOption(step.value);
        else if (step.open) await appPage.locator(step.open).first().click();
        await appPage.waitForTimeout(180);
      }
      const selector = typeof step === 'string' ? step : step.target;
      const locator = appPage.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: 10_000 })
        .catch((error) => { throw new Error(`Tutorial ${id} target ${selector} is not visible: ${error.message}`); });
      stepScreens.push(await capture(selector));
    }
    if (pageErrors.length) throw new AggregateError(pageErrors.splice(0), `Failed to render ${id}.`);
    if (process.env.AURORA_TUTORIAL_VALIDATE_ONLY === '1') {
      console.log(`Validated tutorial targets for ${id}`);
      continue;
    }
    const slideDuration = 5_000;
    const slides = [
      { label: 'COMO USAR', title: guide.title, text: guide.summary, ...titleScreen },
      ...guide.steps.map((step, index) => ({
        label: `PASSO ${index + 1} DE ${guide.steps.length}`,
        ...step,
        ...stepScreens[index],
      })),
      ...(guide.note ? [{
        label: id === 'financas' ? 'PRIVACIDADE' : 'IMPORTANTE',
        title: id === 'financas' ? 'Sem conexão bancária' : 'Informação importante',
        text: id === 'financas'
          ? 'O Aurora não se conecta a bancos nem solicita sua senha. Você decide o que registrar.'
          : 'Estimativas informativas; não substituem avaliação profissional nem servem como método contraceptivo.',
        ...stepScreens[stepScreens.length - 1],
      }] : []),
      {
        label: 'AURORA',
        title: 'Agora é com você',
        text: 'Volte a este vídeo quando quiser pelo botão “Como usar?”.',
        ...titleScreen,
      },
    ];
    const formats = ['mp4'];
    const downloadEvents = [
      videoPage.waitForEvent('download', {
        timeout: 300_000,
        predicate: (download) => download.suggestedFilename().endsWith('.mp4'),
      }),
      videoPage.waitForEvent('download', {
        timeout: 300_000,
        predicate: (download) => download.suggestedFilename().endsWith('.webp'),
      }),
    ];
    const reportPromise = videoPage.evaluate(async ({
      id: videoId,
      accent,
      videoSlides,
      frameRate,
      videoBitrate,
      width,
      height,
      slideDurationMs,
      captionHeight,
      maxPosterBytes,
      mobileMode,
    }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      document.body.replaceChildren(canvas);
      const context = canvas.getContext('2d');
      let posterPromise = null;
      const screens = await Promise.all(videoSlides.map(({ image }) => new Promise((resolve, reject) => {
        const screen = new Image();
        screen.onload = () => resolve(screen);
        screen.onerror = () => reject(new Error('Could not load a captured Aurora screen.'));
        screen.src = `data:image/png;base64,${image}`;
      })));
      const supportedTypes = {
        mp4: ['video/mp4;codecs=avc1.42E01E', 'video/mp4'],
      };
      const formats = Object.entries(supportedTypes).map(([format, candidates]) => {
        const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
        if (!mimeType) throw new Error(`This browser cannot encode the ${format.toUpperCase()} tutorial.`);
        return { format, mimeType };
      });
      const duration = videoSlides.length * slideDurationMs;
      const files = [];
      for (const { format, mimeType } of formats) {
        const stream = canvas.captureStream(frameRate);
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: videoBitrate });
        if (!recorder.mimeType.includes('avc1')) throw new Error('The MP4 tutorial encoder did not select H.264.');
        const chunks = [];
        let frameCount = 0;
        const completed = new Promise((resolve, reject) => {
          recorder.addEventListener('dataavailable', (event) => {
            if (event.data.size) chunks.push(event.data);
          });
          recorder.addEventListener('error', (event) => reject(event.error || new Error(`Failed to encode ${format}.`)));
          recorder.addEventListener('stop', () => {
            const blob = new Blob(chunks, { type: mimeType });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${videoId}.${format}`;
            link.click();
            setTimeout(() => {
              URL.revokeObjectURL(link.href);
              stream.getTracks().forEach((track) => track.stop());
              resolve({ size: blob.size, format, frames: frameCount });
            }, 50);
          }, { once: true });
        });
        const draw = (timestamp, startedAt) => {
          frameCount++;
          const elapsed = Math.max(0, timestamp - startedAt);
          const slideIndex = Math.min(videoSlides.length - 1, Math.floor(elapsed / slideDurationMs));
          const slide = videoSlides[slideIndex];
          const screen = screens[slideIndex];
          context.clearRect(0, 0, width, height);
          if (mobileMode) {
            const scale = Math.min(width / 390, height / 844);
            const renderedWidth = 390 * scale;
            const renderedHeight = 844 * scale;
            const offsetX = (width - renderedWidth) / 2;
            const offsetY = (height - renderedHeight) / 2;
            context.drawImage(screen, offsetX, offsetY, renderedWidth, renderedHeight);
          } else {
            context.drawImage(screen, 0, 0, width, height);
          }

          let focus = slide.focus;
          if (mobileMode && focus.width > 0 && focus.height > 0) {
            const scale = Math.min(width / 390, height / 844);
            const renderedWidth = 390 * scale;
            const offsetX = (width - renderedWidth) / 2;
            const offsetY = (height - 844 * scale) / 2;
            focus = {
              x: offsetX + focus.x * scale,
              y: offsetY + focus.y * scale,
              width: focus.width * scale,
              height: focus.height * scale,
            };
          }
          if (slideIndex > 0 && focus.width > 0 && focus.height > 0) {
            const x = Math.max(8, focus.x - 7);
            const y = Math.max(8, focus.y - 7);
            const right = Math.min(width - 8, focus.x + focus.width + 7);
            const bottom = Math.min(height - 8, focus.y + focus.height + 7);
            context.save();
            context.fillStyle = accent;
            context.strokeStyle = accent;
            context.lineWidth = 4;
            context.shadowColor = accent;
            context.shadowBlur = 18;
            context.beginPath();
            context.roundRect(x, y, Math.max(0, right - x), Math.max(0, bottom - y), 14);
            context.globalAlpha = 0.1;
            context.fill();
            context.globalAlpha = 1;
            context.stroke();
            context.restore();
          }

          const captionScale = mobileMode ? 2 : 1;
          const captionFontScale = mobileMode ? 1.5 : 1;
          const captionX = 66 * captionScale;
          const captionMaxWidth = width - 132 * captionScale;
          const gradient = context.createLinearGradient(0, height - captionHeight, 0, height);
          gradient.addColorStop(0, 'rgba(24, 19, 26, 0)');
          gradient.addColorStop(0.42, 'rgba(24, 19, 26, .76)');
          gradient.addColorStop(1, 'rgba(24, 19, 26, .94)');
          context.fillStyle = gradient;
          context.fillRect(0, height - captionHeight, width, captionHeight);
          context.textAlign = 'left';
          context.fillStyle = '#ffffff';
          context.font = `700 ${16 * captionFontScale}px "Figtree", Arial, sans-serif`;
          context.fillText(slide.label, captionX, height - (mobileMode ? 276 : 126));
          context.font = `500 ${34 * captionFontScale}px "Newsreader", Georgia, serif`;
          const titleLines = [];
          let titleLine = '';
          for (const word of slide.title.split(/\s+/)) {
            const next = titleLine ? `${titleLine} ${word}` : word;
            if (context.measureText(next).width > captionMaxWidth && titleLine) {
              titleLines.push(titleLine);
              titleLine = word;
            } else {
              titleLine = next;
            }
          }
          if (titleLine) titleLines.push(titleLine);
          const visibleTitleLines = titleLines.slice(0, mobileMode ? 2 : 1);
          if (titleLines.length > visibleTitleLines.length) {
            const lastIndex = visibleTitleLines.length - 1;
            let lastLine = visibleTitleLines[lastIndex];
            while (lastLine && context.measureText(`${lastLine}…`).width > captionMaxWidth) {
              lastLine = lastLine.slice(0, lastLine.lastIndexOf(' '));
            }
            visibleTitleLines[lastIndex] = `${lastLine}…`;
          }
          visibleTitleLines.forEach((value, index) => context.fillText(
            value,
            captionX,
            height - (mobileMode ? 208 : 88) + index * (mobileMode ? 58 : 40),
          ));
          context.fillStyle = 'rgba(255,255,255,.88)';
          context.font = `400 ${20 * captionFontScale}px "Figtree", Arial, sans-serif`;
          const words = slide.text.split(/\s+/);
          const lines = [];
          let line = '';
          for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (context.measureText(next).width > captionMaxWidth && line) {
              lines.push(line);
              line = word;
            } else {
              line = next;
            }
          }
          if (line) lines.push(line);
          const visibleLines = lines.slice(0, 2);
          if (lines.length > 2) {
            let lastLine = visibleLines[1];
            while (lastLine && context.measureText(`${lastLine}…`).width > captionMaxWidth) {
              lastLine = lastLine.slice(0, lastLine.lastIndexOf(' '));
            }
            visibleLines[1] = `${lastLine}…`;
          }
          visibleLines.forEach((value, index) => context.fillText(
            value,
            captionX,
            height - (mobileMode ? 103 : 50) + index * (mobileMode ? 38 : 24),
          ));

          const progressWidth = (width - 132 * captionScale) * Math.min(1, elapsed / duration);
          context.fillStyle = 'rgba(255,255,255,.34)';
          context.fillRect(66 * captionScale, height - 12 * captionScale, width - 132 * captionScale, 3 * captionScale);
          context.fillStyle = accent;
          context.fillRect(66 * captionScale, height - 12 * captionScale, progressWidth, 3 * captionScale);
          if (slideIndex === 1 && !posterPromise) {
            const posterCanvas = document.createElement('canvas');
            posterCanvas.width = width;
            posterCanvas.height = height;
            posterCanvas.getContext('2d').drawImage(canvas, 0, 0);
            posterPromise = (async () => {
              let blob;
              for (const quality of [0.82, 0.68, 0.54]) {
                blob = await new Promise((resolve) => posterCanvas.toBlob(resolve, 'image/webp', quality));
                if (!blob || blob.type !== 'image/webp') throw new Error(`Could not encode the ${videoId} WebP poster.`);
                if (blob.size <= maxPosterBytes) break;
              }
              if (!blob || blob.size > maxPosterBytes) {
                throw new Error(`The ${videoId} WebP poster exceeds ${maxPosterBytes} bytes.`);
              }
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${videoId}.webp`;
              link.click();
              await new Promise((resolve) => setTimeout(resolve, 50));
              URL.revokeObjectURL(url);
              return { format: 'webp', size: blob.size };
            })();
          }
          if (elapsed < duration) requestAnimationFrame((nextTimestamp) => draw(nextTimestamp, startedAt));
        };
        recorder.start(250);
        const startedAt = performance.now();
        requestAnimationFrame((timestamp) => draw(timestamp, startedAt));
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, duration + 150);
        files.push(await completed);
      }
      return { files, poster: await posterPromise };
    }, {
      id: fileId,
      accent,
      videoSlides: slides,
      frameRate: VIDEO_FRAME_RATE,
      videoBitrate: VIDEO_BITRATE,
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      slideDurationMs: slideDuration,
      captionHeight: CAPTION_HEIGHT,
      maxPosterBytes: MAX_POSTER_BYTES,
      mobileMode: MOBILE_MODE,
    });

    const [report, downloads] = await Promise.all([reportPromise, Promise.all(downloadEvents)]);
    const generatedFiles = [
      { format: 'mp4', download: downloads[0], result: report.files.find((file) => file.format === 'mp4') },
      { format: 'webp', download: downloads[1], result: report.poster },
    ];
    for (const file of generatedFiles) {
      const { format, download, result } = file;
      const output = join(outputDirectory, `${fileId}.${format}`);
      const tempOutput = join(tempDirectory, `${fileId}.${format}`);
      await download.saveAs(tempOutput);
      if (!result || (format === 'mp4' && (result.size < 10_000 || result.frames < slides.length * 2))
        || (format === 'webp' && (result.size < 1_000 || result.size > MAX_POSTER_BYTES))) {
        throw new Error(`Tutorial ${id} ${format} is incomplete (${result?.frames ?? 0} frames, ${result?.size ?? 0} bytes).`);
      }
      file.output = output;
      file.tempOutput = tempOutput;
    }
    if (pageErrors.length) throw new AggregateError(pageErrors.splice(0), `Failed to render ${id}.`);
    for (const { format, output, tempOutput, result } of generatedFiles) {
      await copyTutorialOutput(tempOutput, output);
      console.log(`Created ${output} (${result.size} bytes)`);
    }
    if (!process.env.AURORA_TUTORIAL_OUTPUT_DIR) {
      await rm(join(outputDirectory, `${id}.webm`), { force: true });
    }
  }
} finally {
  await context?.close();
  await browser?.close();
  await server.close();
  await rm(tempDirectory, { recursive: true, force: true });
}
