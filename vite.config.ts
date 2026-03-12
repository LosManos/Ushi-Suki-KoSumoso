import { defineConfig } from 'vitest/config'
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
    test: {
        // Use Node by default for pure logic
        environment: 'node',
        // But automatically switch to JSDOM for UI components
        environmentMatchGlobs: [
            ['src/components/**/*.test.tsx', 'jsdom']
        ],
        include: ['src/**/*.{test,spec}.{ts,tsx}', 'electron/**/*.{test,spec}.{ts,tsx}'],
        globals: true, // Needed for @testing-library/jest-dom extensions like toBeInTheDocument
        setupFiles: ['./src/setupTests.ts'],
    },
})
