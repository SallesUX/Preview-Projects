import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Dule.app — Acompanhamento do parto',
        short_name: 'Dule',
        description: 'Cronômetro de contrações, notas e relatório para o trabalho de parto.',
        lang: 'pt-BR',
        theme_color: '#f8bcd3',
        background_color: '#fcf5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] }
    })
  ]
})
