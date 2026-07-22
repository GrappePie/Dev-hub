import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { exchangeSoundcloudToken, SoundcloudTokenError } from "./server/soundcloudToken";

const soundcloudTokenDevEndpoint = (env: Record<string, string>): Plugin => ({
  name: "soundcloud-token-dev-endpoint",
  configureServer(server) {
    server.middlewares.use("/api/soundcloud/token", async (request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.setHeader("Cache-Control", "no-store");

      if (request.method !== "POST") {
        response.statusCode = 405;
        response.setHeader("Allow", "POST");
        response.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      try {
        let rawBody = "";
        for await (const chunk of request) {
          rawBody += chunk;
          if (rawBody.length > 16_384) throw new SoundcloudTokenError("Request body too large", 413);
        }
        const token = await exchangeSoundcloudToken(JSON.parse(rawBody || "{}"), env);
        response.statusCode = 200;
        response.end(JSON.stringify(token));
      } catch (error) {
        response.statusCode = error instanceof SoundcloudTokenError ? error.status : 500;
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Token exchange failed" }));
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return ({
  server: {
    host: "127.0.0.1",
    port: 5500,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    soundcloudTokenDevEndpoint(env),
    TanStackRouterVite({ routesDirectory: "src/routes", generatedRouteTree: "src/routeTree.gen.ts" }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  });
});
