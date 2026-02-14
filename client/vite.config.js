import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env from project root so API key is available in build
  const rootEnv = loadEnv(mode, '..', '')
  const apiKey = rootEnv.VITE_SHOPIFY_API_KEY || process.env.VITE_SHOPIFY_API_KEY

  return {
  // Load .env from project root (when building via "cd client && npm run build")
  envDir: '..',
  define:{
    'import.meta.env.VITE_SHOPIFY_API_KEY': JSON.stringify(apiKey),
    'process.env.SHOPIFY_API_KEY': JSON.stringify(rootEnv.SHOPIFY_API_KEY || process.env.SHOPIFY_API_KEY),
    'process.env.VITE_SHOPIFY_API_KEY': JSON.stringify(apiKey),
    'process.env.VITE_STOREFRONT_ACCESS_TOKEN': JSON.stringify(rootEnv.VITE_STOREFRONT_ACCESS_TOKEN || process.env.VITE_STOREFRONT_ACCESS_TOKEN),
    'process.env.VITE_SHOPIFY_STORE_DOMAIN': JSON.stringify(rootEnv.VITE_SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN),
  },
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          shopify: ['@shopify/polaris', '@shopify/app-bridge']
        }
      }
    }
  }
}});
