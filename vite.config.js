import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = {
  '/api': 'http://127.0.0.1:5120',
  '/uploads': 'http://127.0.0.1:5120',
  '/socket.io': { target: 'http://127.0.0.1:5120', ws: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5188,
    strictPort: true,
    host: '127.0.0.1',
    proxy,
  },
  preview: {
    port: 5188,
    strictPort: true,
    host: '127.0.0.1',
    proxy,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('react-dom') ||
              id.includes('react-router') ||
              /node_modules[/\\](react|scheduler)[/\\]/.test(id)
            ) return 'react';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('socket.io') || id.includes('engine.io')) return 'socket';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
            if (id.includes('xlsx')) return 'xlsx';
            if (id.includes('mammoth')) return 'mammoth';
            if (id.includes('dompurify')) return 'sanitize';
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});