import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { readReleaseMetadata } from './scripts/release-metadata.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const releaseMetadata = readReleaseMetadata(root);
const pageEntries = [
  'pages/agua.html',
  'pages/ajustes.html',
  'pages/ciclo.html',
  'pages/financas.html',
  'pages/habitos.html',
  'pages/inicio.html',
  'pages/perfil.html',
  'pages/planejar.html',
  'privacy.html',
  'terms.html',
];

// Expõe o chunk de autenticação para aquecer o formulário sem baixar o app.
function accountChunkHint() {
  return {
    name: 'aurora-account-chunk-hint',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || !ctx.filename?.endsWith('index.html')) return html;
        const chunk = Object.values(ctx.bundle).find((item) => item.type === 'chunk' && item.name === 'account-entry');
        if (!chunk) return html;
        const tag = `<meta name="aurora-account-chunk" content="/${chunk.fileName}">`;
        return html.replace('</head>', `${tag}\n</head>`);
      },
    },
  };
}

function pagesPreviewNotFound() {
  const outputDirectory = resolve(root, 'dist');
  const notFoundFile = resolve(outputDirectory, '404.html');
  return {
    name: 'aurora-pages-preview-not-found',
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        let pathname;
        try {
          pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
        } catch {
          return next();
        }
        if (!/^\/(src|icons|pages)(\/|$)/.test(pathname)) return next();

        const requestedFile = resolve(outputDirectory, `.${pathname}`);
        const isInsideOutput = requestedFile.startsWith(`${outputDirectory}${sep}`);
        if (isInsideOutput && existsSync(requestedFile) && statSync(requestedFile).isFile()) return next();
        if (!existsSync(notFoundFile)) return next();

        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (request.method === 'HEAD') return response.end();
        createReadStream(notFoundFile).pipe(response);
      });
    },
  };
}

function cloudflareHeadersForLocalTests() {
  const rules = [];
  let currentRule = null;
  for (const line of readFileSync(resolve(root, '_headers'), 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      currentRule = { pattern: line.trim(), headers: [] };
      rules.push(currentRule);
      continue;
    }
    if (!currentRule) continue;
    const header = line.trim();
    if (header.startsWith('! ')) {
      currentRule.headers.push({ name: header.slice(2), remove: true });
      continue;
    }
    const separator = header.indexOf(':');
    if (separator > 0) {
      currentRule.headers.push({
        name: header.slice(0, separator).trim(),
        value: header.slice(separator + 1).trim(),
      });
    }
  }

  const applyHeaders = (request, response, next) => {
    let pathname;
    try {
      pathname = new URL(request.url || '/', 'http://localhost').pathname;
    } catch {
      return next();
    }
    for (const rule of rules) {
      const matches = rule.pattern.endsWith('*')
        ? pathname.startsWith(rule.pattern.slice(0, -1))
        : pathname === rule.pattern;
      if (!matches) continue;
      for (const header of rule.headers) {
        if (header.remove) response.removeHeader(header.name);
        else response.setHeader(header.name, header.value);
      }
    }
    return next();
  };

  return {
    name: 'aurora-cloudflare-headers-local-test',
    configureServer(server) {
      server.middlewares.use(applyHeaders);
    },
    configurePreviewServer(server) {
      server.middlewares.use(applyHeaders);
    },
  };
}

export default defineConfig({
  define: {
    __AURORA_RELEASE_METADATA__: JSON.stringify(releaseMetadata),
  },
  plugins: [accountChunkHint(), cloudflareHeadersForLocalTests(), pagesPreviewNotFound()],
  build: {
    rollupOptions: {
      input: ['index.html', ...pageEntries].map((path) => resolve(root, path)),
    },
  },
});
