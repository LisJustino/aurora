import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const pageEntries = [
  'pages/agua.html',
  'pages/ajustes.html',
  'pages/ciclo.html',
  'pages/financas.html',
  'pages/habitos.html',
  'pages/inicio.html',
  'pages/perfil.html',
  'pages/planejar.html',
  'pages/pomodoro.html',
  'privacy.html',
  'terms.html',
];

// Expõe o chunk do app na landing para pré-carregá-lo sem executá-lo.
function appChunkHint() {
  return {
    name: 'aurora-app-chunk-hint',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || !ctx.filename?.endsWith('index.html')) return html;
        const chunk = Object.values(ctx.bundle).find((item) => item.type === 'chunk' && item.name === 'main');
        if (!chunk) return html;
        const tag = `<meta name="aurora-app-chunk" content="/${chunk.fileName}">`;
        return html.replace('</head>', `${tag}\n</head>`);
      },
    },
  };
}

export default defineConfig({
  plugins: [appChunkHint()],
  build: {
    rollupOptions: {
      input: ['index.html', ...pageEntries].map((path) => resolve(root, path)),
    },
  },
});
