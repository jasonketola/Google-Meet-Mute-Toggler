import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig((opt) => {
  return {
    root: 'src',
    build: {
      outDir: '../dist',
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background.ts'),
          sendKeypressMeet: resolve(__dirname, 'src/sendKeypressMeet.ts'),
          sendKeypressTeams: resolve(__dirname, 'src/sendKeypressTeams.ts')
        },
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
  };
});
