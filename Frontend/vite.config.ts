import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Split big libraries into their own cached chunks
const VENDOR_CHUNKS: Record<string, string> = {
  '/node_modules/react/': 'react',
  '/node_modules/react-dom/': 'react',
  '/node_modules/scheduler/': 'react',
  '/node_modules/framer-motion/': 'motion',
  '/node_modules/motion-dom/': 'motion',
  '/node_modules/motion-utils/': 'motion',
  '/node_modules/@supabase/': 'supabase',
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          const normalized = id.replace(/\\/g, '/');
          for (const [path, chunk] of Object.entries(VENDOR_CHUNKS)) {
            if (normalized.includes(path)) return chunk;
          }
          return undefined;
        },
      },
    },
  },
});
