import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The browser must talk to the API on the same origin as the app so the
// SameSite=Lax session and CSRF cookies are stored and sent. In development
// Vite proxies these paths to the FastAPI process. A production deployment
// should expose the same paths through its reverse proxy.
const apiTarget = "http://127.0.0.1:8010";
const apiProxy = {
  "/api": {
    target: apiTarget,
    changeOrigin: false,
  },
  "/ws": {
    target: apiTarget,
    changeOrigin: false,
    ws: true,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
