// vite.config.js
import { defineConfig } from "file:///sessions/adoring-charming-volta/mnt/pharmacheck_v6_final/pharmacheck_integrated/frontend_react/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/adoring-charming-volta/mnt/pharmacheck_v6_final/pharmacheck_integrated/frontend_react/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    port: 3e3,
    proxy: {
      "/check_compliance": "http://localhost:8000",
      "/api": "http://localhost:8000",
      "/health": "http://localhost:8000"
    }
  },
  build: {
    outDir: "../frontend/dist",
    emptyOutDir: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "pdf-renderer": ["@react-pdf/renderer"],
          "map-vendor": ["d3", "topojson-client"],
          "motion-vendor": ["framer-motion"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1jaGFybWluZy12b2x0YS9tbnQvcGhhcm1hY2hlY2tfdjZfZmluYWwvcGhhcm1hY2hlY2tfaW50ZWdyYXRlZC9mcm9udGVuZF9yZWFjdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2Fkb3JpbmctY2hhcm1pbmctdm9sdGEvbW50L3BoYXJtYWNoZWNrX3Y2X2ZpbmFsL3BoYXJtYWNoZWNrX2ludGVncmF0ZWQvZnJvbnRlbmRfcmVhY3Qvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2Fkb3JpbmctY2hhcm1pbmctdm9sdGEvbW50L3BoYXJtYWNoZWNrX3Y2X2ZpbmFsL3BoYXJtYWNoZWNrX2ludGVncmF0ZWQvZnJvbnRlbmRfcmVhY3Qvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgcHJveHk6IHtcbiAgICAgICcvY2hlY2tfY29tcGxpYW5jZSc6ICdodHRwOi8vbG9jYWxob3N0OjgwMDAnLFxuICAgICAgJy9hcGknOiAgICAgICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODAwMCcsXG4gICAgICAnL2hlYWx0aCc6ICAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJyxcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogJy4uL2Zyb250ZW5kL2Rpc3QnLFxuICAgIGVtcHR5T3V0RGlyOiBmYWxzZSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEyMDAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICdyZWFjdC12ZW5kb3InOiAgWydyZWFjdCcsICdyZWFjdC1kb20nXSxcbiAgICAgICAgICAncGRmLXJlbmRlcmVyJzogIFsnQHJlYWN0LXBkZi9yZW5kZXJlciddLFxuICAgICAgICAgICdtYXAtdmVuZG9yJzogICAgWydkMycsICd0b3BvanNvbi1jbGllbnQnXSxcbiAgICAgICAgICAnbW90aW9uLXZlbmRvcic6IFsnZnJhbWVyLW1vdGlvbiddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBK2MsU0FBUyxvQkFBb0I7QUFDNWUsT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxxQkFBcUI7QUFBQSxNQUNyQixRQUFxQjtBQUFBLE1BQ3JCLFdBQXFCO0FBQUEsSUFDdkI7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsSUFDYix1QkFBdUI7QUFBQSxJQUN2QixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsVUFDWixnQkFBaUIsQ0FBQyxTQUFTLFdBQVc7QUFBQSxVQUN0QyxnQkFBaUIsQ0FBQyxxQkFBcUI7QUFBQSxVQUN2QyxjQUFpQixDQUFDLE1BQU0saUJBQWlCO0FBQUEsVUFDekMsaUJBQWlCLENBQUMsZUFBZTtBQUFBLFFBQ25DO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
