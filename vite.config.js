import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/trellospoke/",
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      // This tells Vite: "Don't try to bundle leaflet, it exists globally"
      external: ['leaflet'],
      output: {
        globals: {
          leaflet: 'L',
        },
      },
    },
  },
});
