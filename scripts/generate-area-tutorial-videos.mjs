import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AREA_GUIDES } from '../src/js/features/area-guides.js';

const outputDirectory = fileURLToPath(new URL('../src/assets/tutorials/', import.meta.url));
const VIDEO_FRAME_RATE = 24;
const VIDEO_BITRATE = 2_400_000;
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

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error));
await page.setContent('<!doctype html><html lang="pt-BR"><body></body></html>');

try {
  for (const [id, guide] of guides) {
    const slideDuration = 4_000;
    const durationMilliseconds = (guide.steps.length + 2 + (guide.note ? 1 : 0)) * slideDuration + 100;
    const slides = [
      { label: 'COMO USAR', title: guide.title, text: guide.summary },
      ...guide.steps.map(({ title, text }, index) => ({ label: `PASSO ${index + 1}`, title, text })),
      ...(guide.note ? [{ label: id === 'financas' ? 'PRIVACIDADE' : 'IMPORTANTE', title: id === 'financas' ? 'Sem conexão bancária' : 'Informação importante', text: guide.note }] : []),
      { label: 'AURORA', title: 'Agora é com você', text: 'Volte a este vídeo quando quiser pelo botão “Como usar?”.' },
    ];
    const downloadReady = page.waitForEvent('download', { timeout: 60_000 });
    const report = await page.evaluate(async ({
      id: videoId,
      title,
      accent,
      slides: videoSlides,
      frameRate,
      videoBitrate,
      width,
      height,
    }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      document.body.replaceChildren(canvas);
      const context = canvas.getContext('2d');
      context.scale(width / 1280, height / 720);
      const stream = canvas.captureStream(frameRate);
      const mimeType = ['video/webm;codecs=vp8', 'video/webm']
        .find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('Este navegador não oferece um formato WebM compatível.');
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: videoBitrate });
      const chunks = [];
      let frameCount = 0;
      const slideDuration = 4_000;
      const duration = videoSlides.length * slideDuration;
      const roundRect = (x, y, width, height, radius) => {
        context.beginPath();
        context.roundRect(x, y, width, height, radius);
      };
      const wrappedText = (text, x, y, maxWidth, lineHeight, font, color, maxLines = 5) => {
        context.font = font;
        context.fillStyle = color;
        context.textAlign = 'left';
        const lines = [];
        let line = '';
        for (const word of text.split(/\s+/)) {
          const next = line ? `${line} ${word}` : word;
          if (context.measureText(next).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = next;
          }
        }
        if (line) lines.push(line);
        const visible = lines.slice(0, maxLines);
        if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1].slice(0, -1)}…`;
        visible.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
      };
      const draw = (timestamp) => {
        frameCount++;
        const elapsed = Math.max(0, timestamp - startedAt);
        const slideIndex = Math.max(0, Math.min(videoSlides.length - 1, Math.floor(elapsed / slideDuration)));
        const progress = (elapsed % slideDuration) / slideDuration;
        const slide = videoSlides[slideIndex];
        const entrance = Math.min(1, progress * 3.2);
        const drift = Math.sin(elapsed / 1300) * 11;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fbf7fa';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = `${accent}12`;
        context.beginPath();
        context.arc(1135 + drift, 138, 170, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = `${accent}0b`;
        context.beginPath();
        context.arc(90, 650, 200, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = accent;
        context.font = '700 31px Arial, sans-serif';
        context.textAlign = 'left';
        context.fillText('aurora.', 68, 78);
        context.fillStyle = '#827983';
        context.font = '700 15px Arial, sans-serif';
        context.textAlign = 'right';
        context.fillText(`${title.toLocaleUpperCase('pt-BR')}  ·  TUTORIAL`, 1210, 76);
        context.fillStyle = '#e9e1e7';
        roundRect(68, 105, 1144, 1, 1);
        context.fill();
        context.save();
        context.globalAlpha = entrance;
        context.translate(0, (1 - entrance) * 18);
        context.fillStyle = '#ffffff';
        roundRect(68, 152, 1144, 438, 30);
        context.fill();
        context.strokeStyle = '#eee7ed';
        context.lineWidth = 1;
        roundRect(68, 152, 1144, 438, 30);
        context.stroke();
        context.fillStyle = accent;
        context.font = '800 15px Arial, sans-serif';
        context.textAlign = 'left';
        context.fillText(slide.label, 112, 208);
        if (slideIndex === 0) {
          wrappedText(`Como usar ${slide.title}`, 112, 305, 1000, 66, '700 52px Arial, sans-serif', '#302832', 2);
          wrappedText(slide.text, 112, 405, 990, 43, '400 29px Arial, sans-serif', '#625a64', 3);
        } else if (slideIndex === videoSlides.length - 1) {
          wrappedText(slide.title, 112, 315, 1000, 66, '700 52px Arial, sans-serif', '#302832', 2);
          wrappedText(slide.text, 112, 410, 990, 43, '400 29px Arial, sans-serif', '#625a64', 3);
        } else {
          context.fillStyle = `${accent}16`;
          context.beginPath();
          context.arc(160, 360, 43, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = accent;
          context.textAlign = 'center';
          context.font = '700 27px Arial, sans-serif';
          context.fillText(String(slideIndex), 160, 370);
          context.textAlign = 'left';
          context.fillStyle = '#302832';
          context.font = '700 25px Arial, sans-serif';
          context.fillText(slide.title, 235, 305);
          wrappedText(slide.text, 235, 370, 900, 45, '400 29px Arial, sans-serif', '#625a64', 5);
        }
        context.restore();
        context.fillStyle = '#e9e1e7';
        roundRect(68, 650, 1144, 7, 4);
        context.fill();
        context.fillStyle = accent;
        roundRect(68, 650, 1144 * Math.min(1, elapsed / duration), 7, 4);
        context.fill();
        context.fillStyle = '#827983';
        context.font = '600 14px Arial, sans-serif';
        context.textAlign = 'right';
        context.fillText(`${String(slideIndex + 1).padStart(2, '0')} / ${String(videoSlides.length).padStart(2, '0')}`, 1212, 632);
        if (elapsed < duration) requestAnimationFrame(draw);
      };
      let startedAt = 0;
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size) chunks.push(event.data);
        });
        recorder.addEventListener('error', (event) => reject(event.error || new Error('Falha ao gravar o tutorial.')));
        recorder.addEventListener('stop', () => {
          const blob = new Blob(chunks, { type: mimeType });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${videoId}.webm`;
          link.click();
          setTimeout(() => {
            URL.revokeObjectURL(link.href);
            stream.getTracks().forEach((track) => track.stop());
            resolve({ size: blob.size, frames: frameCount, chunks: chunks.length });
          }, 50);
        }, { once: true });
      });
      recorder.start(250);
      startedAt = performance.now();
      requestAnimationFrame(draw);
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, duration + 100);
      return stopped;
    }, {
      id,
      title: guide.title,
      accent: accents[id],
      slides,
      frameRate: VIDEO_FRAME_RATE,
      videoBitrate: VIDEO_BITRATE,
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
    });
    const download = await downloadReady;
    const output = join(outputDirectory, `${id}.webm`);
    await download.saveAs(output);
    await addSeekableDuration(output, durationMilliseconds);
    if (pageErrors.length) throw new AggregateError(pageErrors.splice(0), `Failed to render ${id}.`);
    if (report.frames < slides.length * 2 || report.size < 10_000) {
      throw new Error(`Tutorial ${id} is incomplete (${report.frames} frames, ${report.size} bytes).`);
    }
    console.log(`Created ${output} (${report.frames} frames, ${report.size} bytes)`);
  }
} finally {
  await context.close();
  await browser.close();
}
