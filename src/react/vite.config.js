import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/entry.jsx'),
      name: 'InventoryReact',
      formats: ['iife'],
      fileName: () => 'inventory-react.js'
    },
    outDir: resolve(__dirname, '../js-dist'),
    emptyOutDir: false,
    minify: 'esbuild'
  }
});
