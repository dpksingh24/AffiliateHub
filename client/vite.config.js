import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({

  define:{
    'process.env.SHOPIFY_API_KEY': JSON.stringify(process.env.SHOPIFY_API_KEY),
    'process.env.VITE_SHOPIFY_API_KEY': JSON.stringify(process.env.VITE_SHOPIFY_API_KEY),
    'process.env.VITE_STOREFRONT_ACCESS_TOKEN': JSON.stringify(process.env.VITE_STOREFRONT_ACCESS_TOKEN),
    'process.env.VITE_SHOPIFY_STORE_DOMAIN': JSON.stringify(process.env.VITE_SHOPIFY_STORE_DOMAIN),
  },
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4300',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:4300',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4300',
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
})
