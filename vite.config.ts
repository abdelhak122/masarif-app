import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // IMPORTANT: This matches your GitHub repository name
    base: '/masarif-app/',
    define: {
      // Enables process.env.API_KEY to work in the browser
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY || "AIzaSyDbWgyGbglelPqlqHWUS1GjNN0m4Ul5H7g")
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    }
  };
});