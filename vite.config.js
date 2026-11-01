import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import apiHandler from "./api/index.js";

const BOT_UA_RE =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Discordbot|Slackbot|Pinterest/i;

function handleSeoOrApiMiddleware(req, res, next) {
  const url = req.url || "";
  if (url.startsWith("/api/")) {
    return apiHandler(req, res);
  }
  if (url === "/sitemap.xml" || url.startsWith("/sitemap.xml?")) {
    req.url = "/api/v1/sitemap.xml";
    return apiHandler(req, res);
  }
  const ua = String(req.headers?.["user-agent"] || "");
  const shopMatch = url.match(/^\/shop\/([^/?#]+)/);
  if (shopMatch && BOT_UA_RE.test(ua)) {
    req.url = `/api/v1/seo-product?id=${encodeURIComponent(shopMatch[1])}`;
    return apiHandler(req, res);
  }
  return next();
}

function localMongoCloudinaryApiPlugin() {
  return {
    name: "local-mongo-cloudinary-api",
    configureServer(server) {
      server.middlewares.use(handleSeoOrApiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleSeoOrApiMiddleware);
    },
  };
}

export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react(), tailwindcss(), localMongoCloudinaryApiPlugin()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase") || id.includes("@firebase")) {
            return "vendor-firebase";
          }
          if (id.includes("node_modules/swiper")) {
            return "vendor-swiper";
          }
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
