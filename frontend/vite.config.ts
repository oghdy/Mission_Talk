import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import aitDevtools from "@apps-in-toss/devtools/unplugin";

export default defineConfig({
  plugins: [react(), aitDevtools.vite()],
  server: {
    proxy: {
      "/persona": "http://localhost:3001",
      "/chat": "http://localhost:3001",
      "/certificate": "http://localhost:3001",
    },
  },
});
