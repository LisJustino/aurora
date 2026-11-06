import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { AREA_GUIDES } from '../src/js/features/area-guides.js';

const rootDirectory = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = join(rootDirectory, 'src', 'assets', 'tutorials');
const VIDEO_FRAME_RATE = 30;
const VIDEO_BITRATE = 2_800_000;
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const accents = {
  inicio: '#b5527a',
  planejar: '#6474c0',
  pomodoro: '#7551a0',
  financas: '#2f796e',
  habitos: '#7b8d46',
  ciclo: '#a84f88',
};
const focusSteps = {
  inicio: ['.home-today-card', '.home-head-actions', '.profile-link'],
  planejar: [
    '.planning-overview',
    { open: '[data-action="plan-view"][data-v="semana"]', target: '[data-action="plan-view"][data-v="semana"]' },
    { open: '[data-action="plan-view"][data-v="lista"]', target: '#task-results' },
    '.task',
  ],
  pomodoro: ['#pomo-focus-label', '[data-action="toggle-free-timer"]', '.free-pomodoro-settings', '.focus-timer'],
  financas: [
    { open: '[data-action="fin-tab"][data-t="contas"]', target: '.fin-section-content' },
    { open: '[data-action="fin-tab"][data-t="lancamentos"]', target: '[data-action="tx-new"]' },
    { open: '[data-action="fin-tab"][data-t="lancamentos"]', target: '.fin-section-content' },
    { open: '[data-action="fin-tab"][data-t="relatorios"]', target: '.fin-section-content' },
  ],
  habitos: ['.habit-today', '[data-action="habit-new"]', '.habit-ideas', '[data-habit-idea]'],
  ciclo: ['.cycle-day-entry', '.cycle-calendar-card', '.cycle-overview'],
};
const readVint = (buffer, offset, includeMarker) => {
  const first = buffer[offset];
  let width = 1;
  for (let marker = 0x80; width <= 8 && !(first & marker); marker >>= 1) width++;
  if (width > 8 || offset + width > buffer.length) throw new Error('Invalid EBML variable integer.');
  let value = BigInt(includeMarker ? first : first & (0xff >> width));
  for (let index = 1; index < width; index++) value = (value << 8n) | BigInt(buffer[offset + index]);
  return {
    value,
    width,
    unknown: !includeMarker && value === (1n << BigInt(width * 7)) - 1n,
  };
};
const readElement = (buffer, offset) => {
  const id = readVint(buffer, offset, true);
  const size = readVint(buffer, offset + id.width, false);
  const dataStart = offset + id.width + size.width;
  const dataEnd = size.unknown ? buffer.length : dataStart + Number(size.value);
  if (dataEnd > buffer.length) throw new Error('EBML element exceeds the video file.');
  return { id: id.value, offset, idWidth: id.width, sizeWidth: size.width, dataStart, dataEnd };
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
const encodeEbmlSize = (size, preferredWidth) => {
  for (let width = preferredWidth; width <= 8; width++) {
    const value = BigInt(size);
    if (value > (1n << BigInt(width * 7)) - 2n) continue;
    let encoded = value | (1n << BigInt(width * 7));
    const result = Buffer.alloc(width);
    for (let index = width - 1; index >= 0; index--) {
      result[index] = Number(encoded & 0xffn);
      encoded >>= 8n;
    }
    return result;
  }
  throw new Error('EBML element is too large to encode.');
};
async function addSeekableDuration(path, durationMilliseconds) {
  const source = await readFile(path);
  const header = readElement(source, 0);
  const segment = readElement(source, header.dataEnd);
  if (segment.id !== 0x18538067n) throw new Error('Generated video is missing its EBML Segment.');
  let info;
  for (let offset = segment.dataStart; offset < segment.dataEnd;) {
    const element = readElement(source, offset);
    if (element.id === 0x1549a966n) {
      info = element;
      break;
    }
    if (element.dataEnd <= offset) throw new Error('Invalid EBML element boundary.');
    offset = element.dataEnd;
  }
  if (!info) throw new Error('Generated video is missing its Info element.');
  const timecodeScaleElement = (() => {
    for (let offset = info.dataStart; offset < info.dataEnd;) {
      const element = readElement(source, offset);
      if (element.id === 0x2ad7b1n) return element;
      offset = element.dataEnd;
    }
    return null;
  })();
  let timecodeScale = 1_000_000n;
  if (timecodeScaleElement) {
    timecodeScale = 0n;
    for (let offset = timecodeScaleElement.dataStart; offset < timecodeScaleElement.dataEnd; offset++) {
      timecodeScale = (timecodeScale << 8n) | BigInt(source[offset]);
    }
  }
  const duration = Buffer.alloc(8);
  duration.writeDoubleBE(durationMilliseconds * 1_000_000 / Number(timecodeScale));
  const durationElement = Buffer.concat([Buffer.from([0x44, 0x89, 0x88]), duration]);
  const infoPayload = Buffer.concat([source.subarray(info.dataStart, info.dataEnd), durationElement]);
  const infoHeader = Buffer.concat([
    source.subarray(info.offset, info.offset + info.idWidth),
    encodeEbmlSize(infoPayload.length, info.sizeWidth),
  ]);
  const updated = Buffer.concat([
    source.subarray(0, info.offset),
    infoHeader,
    infoPayload,
    source.subarray(info.dataEnd),
  ]);
  await writeFile(path, updated);
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
    viewport: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
  });
  const appPage = await context.newPage();
  const videoPage = await context.newPage();
  const pageErrors = [];
  appPage.on('pageerror', (error) => pageErrors.push(error));
  videoPage.on('pageerror', (error) => pageErrors.push(error));
  await videoPage.goto(`${baseUrl}/terms.html`);
  await videoPage.setContent(`<!doctype html><html lang="pt-BR"><head><style>@font-face{font-family:"DM Sans";src:url("/src/fonts/dm-sans-latin.woff2") format("woff2");font-weight:100 1000}</style></head><body></body></html>`);
  await videoPage.evaluate(() => document.fonts.load('400 20px "DM Sans"'));

  for (const [id, guide] of guides) {
    const steps = focusSteps[id];
    if (!steps || steps.length !== guide.steps.length) {
      throw new Error(`Tutorial ${id} is missing one or more matching screen highlights.`);
    }

    await appPage.goto(`${baseUrl}/?preview#${id}`);
    await appPage.locator('.area-guide-button').waitFor({ state: 'visible', timeout: 45_000 });
    await appPage.evaluate(() => document.fonts.ready);
    const capture = async (selector) => {
      const locator = selector ? appPage.locator(selector).first() : appPage.locator('.main');
      if (!await locator.count()) throw new Error(`Tutorial ${id} could not find screen target: ${selector}`);
      await locator.scrollIntoViewIfNeeded();
      await appPage.waitForTimeout(150);
      const rect = await locator.evaluate((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      });
      return {
        image: (await appPage.screenshot({ type: 'png' })).toString('base64'),
        focus: rect,
      };
    };

    const titleScreen = await capture('.main');
    const stepScreens = [];
    for (const step of steps) {
      if (typeof step === 'object') {
        await appPage.locator(step.open).first().click();
        await appPage.waitForTimeout(180);
      }
      const selector = typeof step === 'string' ? step : step.target;
      const locator = appPage.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: 10_000 })
        .catch((error) => { throw new Error(`Tutorial ${id} target ${selector} is not visible: ${error.message}`); });
      stepScreens.push(await capture(selector));
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
    const durationMilliseconds = slides.length * slideDuration + 100;
    const formats = ['webm', 'mp4'];
    const downloadEvents = formats.map((format) => videoPage.waitForEvent('download', {
      timeout: 300_000,
      predicate: (download) => download.suggestedFilename().endsWith(`.${format}`),
    }));
    const reportPromise = videoPage.evaluate(async ({
      id: videoId,
      accent,
      videoSlides,
      frameRate,
      videoBitrate,
      width,
      height,
      slideDurationMs,
    }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      document.body.replaceChildren(canvas);
      const context = canvas.getContext('2d');
      const screens = await Promise.all(videoSlides.map(({ image }) => new Promise((resolve, reject) => {
        const screen = new Image();
        screen.onload = () => resolve(screen);
        screen.onerror = () => reject(new Error('Could not load a captured Aurora screen.'));
        screen.src = `data:image/png;base64,${image}`;
      })));
      const supportedTypes = {
        webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
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
          context.drawImage(screen, 0, 0, width, height);

          const focus = slide.focus;
          if (slideIndex > 0 && focus.width > 0 && focus.height > 0) {
            const x = Math.max(8, focus.x - 7);
            const y = Math.max(8, focus.y - 7);
            const right = Math.min(width - 8, focus.x + focus.width + 7);
            const bottom = Math.min(height - 8, focus.y + focus.height + 7);
            context.save();
            context.fillStyle = `${accent}18`;
            context.strokeStyle = accent;
            context.lineWidth = 4;
            context.shadowColor = accent;
            context.shadowBlur = 18;
            context.beginPath();
            context.roundRect(x, y, Math.max(0, right - x), Math.max(0, bottom - y), 14);
            context.fill();
            context.stroke();
            context.restore();
          }

          const gradient = context.createLinearGradient(0, height - 250, 0, height);
          gradient.addColorStop(0, 'rgba(24, 19, 26, 0)');
          gradient.addColorStop(0.42, 'rgba(24, 19, 26, .76)');
          gradient.addColorStop(1, 'rgba(24, 19, 26, .94)');
          context.fillStyle = gradient;
          context.fillRect(0, height - 250, width, 250);
          context.textAlign = 'left';
          context.fillStyle = '#ffffff';
          context.font = '700 16px "DM Sans", Arial, sans-serif';
          context.fillText(slide.label, 66, height - 118);
          context.font = '700 34px "DM Sans", Arial, sans-serif';
          context.fillText(slide.title, 66, height - 72, width - 132);
          context.fillStyle = 'rgba(255,255,255,.88)';
          context.font = '400 20px "DM Sans", Arial, sans-serif';
          const words = slide.text.split(/\s+/);
          const lines = [];
          let line = '';
          for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (context.measureText(next).width > width - 132 && line) {
              lines.push(line);
              line = word;
            } else {
              line = next;
            }
          }
          if (line) lines.push(line);
          const visibleLines = lines.slice(0, 2);
          if (lines.length > 2) visibleLines[1] = `${visibleLines[1].slice(0, -1)}…`;
          visibleLines.forEach((value, index) => context.fillText(value, 66, height - 36 + index * 24));

          const progressWidth = (width - 132) * Math.min(1, elapsed / duration);
          context.fillStyle = 'rgba(255,255,255,.34)';
          context.fillRect(66, height - 12, width - 132, 3);
          context.fillStyle = accent;
          context.fillRect(66, height - 12, progressWidth, 3);
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
      return { files };
    }, {
      id,
      accent: accents[id],
      videoSlides: slides,
      frameRate: VIDEO_FRAME_RATE,
      videoBitrate: VIDEO_BITRATE,
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      slideDurationMs: slideDuration,
    });

    const [report, downloads] = await Promise.all([reportPromise, Promise.all(downloadEvents)]);
    for (const [index, download] of downloads.entries()) {
      const format = formats[index];
      const output = join(outputDirectory, `${id}.${format}`);
      const tempOutput = join(tempDirectory, `${id}.${format}`);
      await download.saveAs(tempOutput);
      if (format === 'webm') await addSeekableDuration(tempOutput, durationMilliseconds);
      await copyTutorialOutput(tempOutput, output);
      const result = report.files.find((file) => file.format === format);
      if (!result || result.size < 10_000 || result.frames < slides.length * 2) {
        throw new Error(`Tutorial ${id} ${format} is incomplete (${result?.frames ?? 0} frames, ${result?.size ?? 0} bytes).`);
      }
      console.log(`Created ${output} (${result.size} bytes)`);
    }
    if (pageErrors.length) throw new AggregateError(pageErrors.splice(0), `Failed to render ${id}.`);
  }
} finally {
  await context?.close();
  await browser?.close();
  await server.close();
  await rm(tempDirectory, { recursive: true, force: true });
}
