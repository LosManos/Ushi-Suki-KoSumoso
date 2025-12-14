import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './',
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                compare: resolve(__dirname, 'compare.html'),
            },
        },
    },
})
