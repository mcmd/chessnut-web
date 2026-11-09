import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/chessnut-web/',
  plugins: [react()],
  test: { environment: 'node' },
})
