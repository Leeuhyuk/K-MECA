import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  // 라이브러리(IIFE) 빌드는 앱 빌드와 달리 process.env.NODE_ENV 를 자동 치환하지 않는다.
  // 브라우저에는 process 전역이 없어 React 프로덕션 번들이 ReferenceError 를 던지므로 여기서 주입한다.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
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
