import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relative : l'application fonctionne telle quelle sous
// https://<compte>.github.io/Analyse_40k/ sans configuration supplémentaire.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});
