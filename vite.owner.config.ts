import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// Café owner onboarding: a separate page with its own build, so the customer app build stays as it is.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-owner',
    rollupOptions: {input: 'owner.html'},
  },
});
