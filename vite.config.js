import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  build: {
    target: "esnext",
    minify: false,
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ["three/webgpu"],
  },
});
