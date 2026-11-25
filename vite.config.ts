import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const isSingle = mode === 'single';
  return {
    base: './',
    plugins: isSingle ? [preact(), viteSingleFile()] : [preact()],
    build: {
      target: 'es2022',
      outDir: isSingle ? 'dist-single' : 'dist',
      assetsInlineLimit: isSingle ? 100000000 : 8192,
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
