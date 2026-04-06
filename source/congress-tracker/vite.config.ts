import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// GitHub Pages deployment: set VITE_BASE_PATH to your repo name (e.g. "/congress-tracker")
// For a user/org site (username.github.io), leave it as "/"
// For a project site (username.github.io/repo), set it to "/repo"
const BASE_PATH = process.env.VITE_BASE_PATH || "./";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: BASE_PATH,
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Increase chunk size limit for the member index
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split large dependencies into separate chunks for faster initial load
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "ui-vendor": ["@radix-ui/react-select", "@radix-ui/react-dialog", "lucide-react"],
          "query-vendor": ["@tanstack/react-query", "wouter"],
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
