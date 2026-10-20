import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages project sites live under /<repo>/; the deploy workflow passes that prefix.
  base: process.env.BASE_PATH || "/",
  server: {
    host: "127.0.0.1",
    port: 5500,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    TanStackRouterVite({ routesDirectory: "src/routes", generatedRouteTree: "src/routeTree.gen.ts" }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes rarely, so keeping it apart lets browsers cache it across deploys.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) return "tanstack";
          if (/[\\/]node_modules[\\/]gsap[\\/]/.test(id)) return "gsap";
        },
      },
    },
  },
});
