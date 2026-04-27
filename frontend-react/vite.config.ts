import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Legacy unauthenticated endpoint (Phase 3 compat)
      "/check_compliance": {
        target: "http://localhost:8000",
        changeOrigin: true,
        proxyTimeout: 120_000,
        timeout: 120_000,
      },
      // Authenticated API endpoints
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        proxyTimeout: 180_000,
        timeout: 180_000,
      },
      // Auth endpoints
      "/auth": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      // Health check
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          d3: ["d3", "topojson-client"],
        },
      },
    },
  },
});
