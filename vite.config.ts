import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  base: '/fng-operadores/',
  plugins: [preact()],
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['shared/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node' },
})
