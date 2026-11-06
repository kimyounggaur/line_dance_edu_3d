import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src/', import.meta.url));

export default defineConfig({
  resolve: { alias: [{ find: /^@\/(.*)$/, replacement: `${src}$1` }] },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
