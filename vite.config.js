import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/trellospoke/",
  plugins: [react()],
  build: {
    outDir: "dist",
  },
});
