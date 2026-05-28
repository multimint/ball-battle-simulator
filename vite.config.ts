import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/ball-battle-simulator/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  optimizeDeps: {
    include: ['mp4-muxer'],
  },
  server: { port: 5173 },
});
