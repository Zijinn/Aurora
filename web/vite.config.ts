/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const devAPITarget = process.env.AURORA_DEV_API ?? "http://127.0.0.1:7381"
const devPort = Number(process.env.AURORA_DEV_PORT ?? 4173)

export default defineConfig({
  plugins: [
    react(),
    {
      name: "cairn-desktop-compatible-entry",
      apply: "build",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          // WKWebView does not request Vite's module entry over the wails://
          // scheme. The bundled entry has no external ESM imports, so load it
          // as a deferred classic script in production builds.
          return html
            .replace(/<script type="module" crossorigin([^>]*)>/g, "<script defer$1>")
            .replace(/<link rel="stylesheet" crossorigin([^>]*)>/g, '<link rel="stylesheet"$1>')
        },
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/aurora-32.png",
        "icons/aurora-180.png",
        "icons/aurora-192.png",
        "icons/aurora-512.png",
      ],
      manifest: {
        name: "Aurora",
        short_name: "Aurora",
        description: "A private reading home for the open web.",
        lang: "zh-CN",
        theme_color: "#f5f5f6",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/aurora-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/aurora-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/aurora-maskable-512.png",
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
    port: Number.isFinite(devPort) ? devPort : 4173,
    proxy: {
      "/api": devAPITarget,
      "/healthz": devAPITarget,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
})
