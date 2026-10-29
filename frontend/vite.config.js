import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // The 13 MB GLB locks on Windows; watching it crashes the dev server.
    watch: { ignored: ["**/public/models/**"] },
  },
});
