import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { VitePWA } from "vite-plugin-pwa"; // 1. Import added
import { readFileSync } from "fs";
const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    // 2. PWA Config added here
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // Ensures the script is injected automatically
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifestFilename: 'manifest.json', // Force filename to manifest.json
      manifest: {
        name: 'MuseMelody',
        short_name: 'MuseMelody',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#FF9A9E',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  define: {
    // This makes the version available to your frontend
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
  },
  // Note: Since your root is "client", Vite looks for the public folder inside "client"
  root: path.resolve(__dirname, "client"),

  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // This allows the tunnel to bypass the host check
    allowedHosts: true, 
    cors: true,
    hmr: {
      // Ensures hot module replacement works over the tunnel
      clientPort: 443, 
    },
  },

  preview: {
    host: true,
    port: 4173,
    strictPort: false,
    // This is the critical line for 'npm run preview'
    allowedHosts: true,
    cors: true,
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});