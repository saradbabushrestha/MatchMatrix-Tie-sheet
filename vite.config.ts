import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the heavy, independently-loaded libraries out of the app bundle:
        // the bracket canvas and the export pipeline are both large and are not
        // needed to render the tournament list or the wizard.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          flow: ['@xyflow/react'],
          pdf: ['jspdf', 'jspdf-autotable', 'html-to-image'],
          sheets: ['papaparse', 'read-excel-file', 'write-excel-file'],
        },
      },
    },
  },
})
