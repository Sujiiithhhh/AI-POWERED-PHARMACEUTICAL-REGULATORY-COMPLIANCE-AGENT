// vite.config.ts
import { defineConfig } from "file:///sessions/adoring-charming-volta/mnt/pharmacheck_v6_final/frontend-react/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/adoring-charming-volta/mnt/pharmacheck_v6_final/frontend-react/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "/sessions/adoring-charming-volta/mnt/pharmacheck_v6_final/frontend-react";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    proxy: {
      // Legacy unauthenticated endpoint (Phase 3 compat)
      "/check_compliance": {
        target: "http://localhost:8000",
        changeOrigin: true,
        proxyTimeout: 12e4,
        timeout: 12e4
      },
      // Authenticated API endpoints
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        proxyTimeout: 18e4,
        timeout: 18e4
      },
      // Auth endpoints
      "/auth": {
        target: "http://localhost:8000",
        changeOrigin: true
      },
      // Health check
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true
      }
    }
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
          d3: ["d3", "topojson-client"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1jaGFybWluZy12b2x0YS9tbnQvcGhhcm1hY2hlY2tfdjZfZmluYWwvZnJvbnRlbmQtcmVhY3RcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9hZG9yaW5nLWNoYXJtaW5nLXZvbHRhL21udC9waGFybWFjaGVja192Nl9maW5hbC9mcm9udGVuZC1yZWFjdC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvYWRvcmluZy1jaGFybWluZy12b2x0YS9tbnQvcGhhcm1hY2hlY2tfdjZfZmluYWwvZnJvbnRlbmQtcmVhY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHByb3h5OiB7XG4gICAgICAvLyBMZWdhY3kgdW5hdXRoZW50aWNhdGVkIGVuZHBvaW50IChQaGFzZSAzIGNvbXBhdClcbiAgICAgIFwiL2NoZWNrX2NvbXBsaWFuY2VcIjoge1xuICAgICAgICB0YXJnZXQ6IFwiaHR0cDovL2xvY2FsaG9zdDo4MDAwXCIsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgcHJveHlUaW1lb3V0OiAxMjBfMDAwLFxuICAgICAgICB0aW1lb3V0OiAxMjBfMDAwLFxuICAgICAgfSxcbiAgICAgIC8vIEF1dGhlbnRpY2F0ZWQgQVBJIGVuZHBvaW50c1xuICAgICAgXCIvYXBpXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6ODAwMFwiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHByb3h5VGltZW91dDogMTgwXzAwMCxcbiAgICAgICAgdGltZW91dDogMTgwXzAwMCxcbiAgICAgIH0sXG4gICAgICAvLyBBdXRoIGVuZHBvaW50c1xuICAgICAgXCIvYXV0aFwiOiB7XG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIC8vIEhlYWx0aCBjaGVja1xuICAgICAgXCIvaGVhbHRoXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6ODAwMFwiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiBcImRpc3RcIixcbiAgICBlbXB0eU91dERpcjogZmFsc2UsXG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgdmVuZG9yOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0LXJvdXRlci1kb21cIl0sXG4gICAgICAgICAgbW90aW9uOiBbXCJmcmFtZXItbW90aW9uXCJdLFxuICAgICAgICAgIGQzOiBbXCJkM1wiLCBcInRvcG9qc29uLWNsaWVudFwiXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwWSxTQUFTLG9CQUFvQjtBQUN2YSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBRmpCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUE7QUFBQSxNQUVMLHFCQUFxQjtBQUFBLFFBQ25CLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLGNBQWM7QUFBQSxRQUNkLFNBQVM7QUFBQSxNQUNYO0FBQUE7QUFBQSxNQUVBLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLGNBQWM7QUFBQSxRQUNkLFNBQVM7QUFBQSxNQUNYO0FBQUE7QUFBQSxNQUVBLFNBQVM7QUFBQSxRQUNQLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBO0FBQUEsTUFFQSxXQUFXO0FBQUEsUUFDVCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsTUFDaEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLElBQ2IsV0FBVztBQUFBLElBQ1gsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osUUFBUSxDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxVQUNqRCxRQUFRLENBQUMsZUFBZTtBQUFBLFVBQ3hCLElBQUksQ0FBQyxNQUFNLGlCQUFpQjtBQUFBLFFBQzlCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
