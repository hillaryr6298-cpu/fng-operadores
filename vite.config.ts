import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  base: './', // rutas relativas: funciona en hillaryr6298-cpu.github.io/fng-operadores/ y en un dominio propio en la raíz
  plugins: [preact()],
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['shared/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node' },
})
