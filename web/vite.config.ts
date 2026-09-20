import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  // Vite 默认 root 即本目录，无需显式设置。
  server: {
    port: 5173,
    // 前后端同源：/api 统一代理到后端网关(默认 8735)。
    proxy: {
      "/api": {
        target: process.env.ZHULONG_API ?? "http://127.0.0.1:8735",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});