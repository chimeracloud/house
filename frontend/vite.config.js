import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query', 'zustand'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          'ui-vendor': ['@headlessui/react', '@heroicons/react'],
          'chart-vendor': ['recharts'],
          'form-vendor': ['react-hook-form', 'react-hot-toast'],
          'date-vendor': ['date-fns'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
