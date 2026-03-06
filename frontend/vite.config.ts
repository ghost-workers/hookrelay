// ABOUTME: Vite configuration for HookRelay frontend.
// ABOUTME: Configures React plugin and proxies API requests to backend in dev mode.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: './frontend',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3200',
      '/h': 'http://localhost:3200',
      '/stream': 'http://localhost:3200',
    },
  },
});
