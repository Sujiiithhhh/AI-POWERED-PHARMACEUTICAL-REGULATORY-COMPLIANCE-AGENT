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
    emptyOutDir: true,
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1jaGFybWluZy12b2x0YS9tbnQvcGhhcm1hY2hlY2tfdjZfZmluYWwvcGhhcm1hY2hlY2tfaW50ZWdyYXRlZC9mcm9udGVuZF9yZWFjdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2Fkb3JpbmctY2hhcm1pbmctdm9sdGEvbW50L3BoYXJtYWNoZWNrX3Y2X2ZpbmFsL3BoYXJtYWNoZWNrX2ludGVncmF0ZWQvZnJvbnRlbmRfcmVhY3Qvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2Fkb3JpbmctY2hhcm1pbmctdm9sdGEvbW50L3BoYXJtYWNoZWNrX3Y2X2ZpbmFsL3BoYXJtYWNoZWNrX2ludGVncmF0ZWQvZnJvbnRlbmRfcmVhY3Qvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgcHJveHk6IHtcbiAgICAgICcvY2hlY2tfY29tcGxpYW5jZSc6ICdodHRwOi8vbG9jYWxob3N0OjgwMDAnLFxuICAgICAgJy9hcGknOiAgICAgICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODAwMCcsXG4gICAgICAnL2hlYWx0aCc6ICAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJyxcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogJy4uL2Zyb250ZW5kL2Rpc3QnLFxuICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTIwMCxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgJ3JlYWN0LXZlbmRvcic6ICBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddLFxuICAgICAgICAgICdwZGYtcmVuZGVyZXInOiAgWydAcmVhY3QtcGRmL3JlbmRlcmVyJ10sXG4gICAgICAgICAgJ21hcC12ZW5kb3InOiAgICBbJ2QzJywgJ3RvcG9qc29uLWNsaWVudCddLFxuICAgICAgICAgICdtb3Rpb24tdmVuZG9yJzogWydmcmFtZXItbW90aW9uJ10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUErYyxTQUFTLG9CQUFvQjtBQUM1ZSxPQUFPLFdBQVc7QUFFbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLHFCQUFxQjtBQUFBLE1BQ3JCLFFBQXFCO0FBQUEsTUFDckIsV0FBcUI7QUFBQSxJQUN2QjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxJQUNiLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxVQUNaLGdCQUFpQixDQUFDLFNBQVMsV0FBVztBQUFBLFVBQ3RDLGdCQUFpQixDQUFDLHFCQUFxQjtBQUFBLFVBQ3ZDLGNBQWlCLENBQUMsTUFBTSxpQkFBaUI7QUFBQSxVQUN6QyxpQkFBaUIsQ0FBQyxlQUFlO0FBQUEsUUFDbkM7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
