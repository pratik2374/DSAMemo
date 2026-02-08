import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GOOGLE_SERVICE_ACCOUNT_TYPE': JSON.stringify(env.GOOGLE_SERVICE_ACCOUNT_TYPE),
      'process.env.GOOGLE_PROJECT_ID': JSON.stringify(env.GOOGLE_PROJECT_ID),
      'process.env.GOOGLE_PRIVATE_KEY_ID': JSON.stringify(env.GOOGLE_PRIVATE_KEY_ID),
      'process.env.GOOGLE_PRIVATE_KEY': JSON.stringify(env.GOOGLE_PRIVATE_KEY),
      'process.env.GOOGLE_CLIENT_EMAIL': JSON.stringify(env.GOOGLE_CLIENT_EMAIL),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID),
      'process.env.GOOGLE_AUTH_URI': JSON.stringify(env.GOOGLE_AUTH_URI),
      'process.env.GOOGLE_TOKEN_URI': JSON.stringify(env.GOOGLE_TOKEN_URI),
      'process.env.GOOGLE_AUTH_PROVIDER_CERT_URL': JSON.stringify(env.GOOGLE_AUTH_PROVIDER_CERT_URL),
      'process.env.GOOGLE_CLIENT_CERT_URL': JSON.stringify(env.GOOGLE_CLIENT_CERT_URL),
      'process.env.GOOGLE_UNIVERSE_DOMAIN': JSON.stringify(env.GOOGLE_UNIVERSE_DOMAIN),
      'process.env.GOOGLE_SHEET_ID': JSON.stringify(env.GOOGLE_SHEET_ID)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
