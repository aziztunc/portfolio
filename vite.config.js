import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    allowedHosts: [".cursorvm.com"],
  },
  preview: {
    host: true,
    allowedHosts: [".cursorvm.com"],
  },
});
