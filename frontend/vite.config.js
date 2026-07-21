import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

// VITE_DOCKER is declared in compose.dev.yaml file
const isDocker = process.env.VITE_DOCKER === "true";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        }
      }
    },
  },
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      // Lets the service worker actually run under `vite dev` too (off by
      // default), so offline behavior can be tested locally without a full
      // production build/deploy.
      devOptions: {
        enabled: true,
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // `null` (the previous value) disables the SPA offline fallback
        // entirely: a hard reload/deep link, or a route whose code-split
        // chunk hasn't been fetched into memory yet in the current tab
        // (e.g. navigating to /po/list without ever having visited it this
        // session), would fail outright while offline instead of being
        // served the cached app shell. Every built route chunk is already
        // in the precache (globPatterns above), so falling back to the
        // cached index.html lets TanStack Router boot and resolve the
        // requested route from that same precache.
        navigateFallback: 'index.html',
        // Real backend calls are same-origin fetch/XHR, not navigations, so
        // this denylist is belt-and-suspenders: it keeps the SPA fallback
        // from ever being served for an actual navigation to a non-SPA path.
        navigateFallbackDenylist: [/^\/api\//, /^\/cdn\//, /^\/login-auth\//],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    watch: isDocker ? {
      usePolling: true,
      interval: 1000,
      ignored: ['**/node_modules/**', '**/public/**'],
    } : {
      usePolling: true,
    },
    proxy: isDocker 
  ? {
      '/api': 'http://backend:5000',
      '/login-auth': 'http://auth-backend:5005',
      '/socket.io': {
        target: 'http://backend:5000',
        ws: true,  // Add WebSocket support
        changeOrigin: true
      },
      '/cdn': 'http://cdn:5001',
    }
  : {
      '/api': 'http://localhost:5000',
      '/login-auth': 'http://localhost:5005',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true
      },
      '/cdn': 'http://localhost:5001',
    }
  }
});