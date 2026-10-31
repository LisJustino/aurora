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

export default defineConfig({
  build: {
    rollupOptions: {
      input: ['index.html', ...pageEntries].map((path) => resolve(root, path)),
    },
  },
});
