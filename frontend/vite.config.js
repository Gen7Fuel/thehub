import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

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
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), viteReact(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      usePolling: true,
    },
    proxy: isDocker 
  ? {
      '/api': 'http://backend:5000',
      '/socket.io': {
        target: 'http://backend:5000',
        ws: true,  // Add WebSocket support
        changeOrigin: true
      },
      '/cdn': 'http://cdn:5001',
    }
  : {
      '/api': 'http://localhost:5000',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,  // Add WebSocket support
        changeOrigin: true
      },
      '/cdn': 'http://localhost:5001',
    }
  }
});