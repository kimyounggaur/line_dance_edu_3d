import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// 미리보기용 단일 페이지 빌드 (claude.ai 아티팩트처럼 정적 파일만 올리는 곳에서 쓰기 위한 것).
// 화면은 Next.js 앱과 같은 src/views 를 쓰고, 경로 대신 #해시로 화면을 바꾼다 (src/platform/spa.tsx).
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('./preview'),
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\/platform$/, replacement: r('./src/platform/spa.tsx') },
      { find: /^@\/(.*)$/, replacement: `${r('./src/')}$1` },
    ],
  },
  build: {
    outDir: r('./dist-preview'),
    emptyOutDir: true,
    assetsDir: 'assets',
    chunkSizeWarningLimit: 2500,
  },
});
