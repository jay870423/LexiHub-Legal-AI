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
      // Priority: 
      // 1. API_KEY (Standard)
      // 2. APP_KEY (User specific request)
      // 3. GEMINI_API_KEY (Common alternative)
      'process.env.API_KEY': JSON.stringify(
        env.API_KEY || env.APP_KEY || env.GEMINI_API_KEY || 
        process.env.API_KEY || process.env.APP_KEY || process.env.GEMINI_API_KEY
      ),
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