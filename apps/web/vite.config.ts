import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

// Builds the simulated Echo client and the shared stylesheet with fixed names under /assets.
export default defineConfig({
  plugins: [preact()],
  base: "/assets/",
  build: {
    outDir: "dist/assets",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        site: "src/styles/site.css",
        echo: "echo/src/main.tsx",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (info) =>
          info.names?.some((name) => name.endsWith(".css"))
            ? "[name][extname]"
            : "files/[name]-[hash][extname]",
      },
    },
  },
});
