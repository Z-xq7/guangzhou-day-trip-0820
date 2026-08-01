import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fromProjectRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: "/guangzhou-day-trip-0820/",
  root: fromProjectRoot("./static-site/"),
  publicDir: fromProjectRoot("./public/"),
  plugins: [react()],
  build: {
    outDir: fromProjectRoot("./dist-pages/"),
    emptyOutDir: true,
  },
});
