import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY for the @google/genai SDK
      // Priority: 1. Loaded from .env (local) 2. process.env (Vercel system env)
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
    },
    server: {
      proxy: {
        '/api/proxy/serpapi': {
          target: 'https://serpapi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/proxy\/serpapi/, ''),
        },
        '/api/proxy/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/proxy\/deepseek/, ''),
        },
      },
    },
  };
});