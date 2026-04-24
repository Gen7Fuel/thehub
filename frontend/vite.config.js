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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: null,
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
      '/signaling': {
        target: 'http://signaling:5002',
        ws: true,
        changeOrigin: true
      }
    }
  : {
      '/api': 'http://localhost:5000',
      '/login-auth': 'http://localhost:5005',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,  // Add WebSocket support
        changeOrigin: true
      },
      '/cdn': 'http://localhost:5001',
      '/signaling': {
        target: 'http://localhost:5002',
        ws: true,
        changeOrigin: true
      }
    }
  }
});