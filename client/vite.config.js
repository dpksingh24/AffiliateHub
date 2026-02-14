import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  // Load .env from project root so VITE_SHOPIFY_API_KEY is available at build time
  envDir: '..',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
