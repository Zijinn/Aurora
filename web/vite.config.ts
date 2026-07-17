/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/cairn-192.png", "icons/cairn-512.png"],
      manifest: {
        name: "Cairn",
        short_name: "Cairn",
        description: "A private reading home for the open web.",
        theme_color: "#f4f3ef",
        background_color: "#f4f3ef",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/cairn-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/cairn-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/cairn-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/v1/entries"),
            handler: "NetworkFirst",
            options: {
              cacheName: "cairn-entry-api",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 7 },
              networkTimeoutSeconds: 4,
            },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": "http://127.0.0.1:7381",
      "/healthz": "http://127.0.0.1:7381",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
})
