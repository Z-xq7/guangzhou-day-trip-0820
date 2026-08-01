import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    environmentOptions: {
      jsdom: { url: "http://localhost:3000/" },
    },
  },
});
