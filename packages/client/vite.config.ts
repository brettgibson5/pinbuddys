import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@pinbuddys/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
          colyseus: ["colyseus.js"],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
