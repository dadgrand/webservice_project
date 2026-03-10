import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const chunkPath = id.split('node_modules/')[1] || '';
          const parts = chunkPath.split('/');
          const pkg = parts[0]?.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];

          if (!pkg) return 'vendor';

          if (pkg.startsWith('@mui/') || pkg.startsWith('@emotion/')) return 'mui';
          if (pkg.startsWith('@tiptap/')) return 'tiptap';
          if (pkg === 'mammoth') return 'mammoth';
          if (['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom', 'history'].includes(pkg)) return 'react-core';
          if (pkg.startsWith('@tanstack/')) return 'query';
          if (['socket.io-client', 'engine.io-client', 'socket.io-parser'].includes(pkg)) return 'socket';
          if (pkg === 'axios') return 'network';
          if (pkg === 'date-fns') return 'date-fns';
          if (pkg === 'zustand') return 'state';
          if (pkg === 'uuid') return 'utils';

          return 'vendor';
        },
      },
    },
  },
})
