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
      // 워밍업(warmUpBackend)이 로컬에서도 실제 백엔드를 타도록 — 없으면 Vite dev
      // 서버가 받아서 404가 나므로 프로덕션과 동작이 달라진다.
      "/health": "http://localhost:3001",
    },
  },
});
