import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the browser talks to Vite only. Vite forwards /api to the
// handlers, so the session cookie and the origin check see one origin, the
// same as behind nginx in production.
const handlersUrl = process.env["HANDLERS_URL"] ?? "http://handlers:8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // Vite refuses a request whose Host header it does not know. The
    // end-to-end container reaches this server as http://web:5173.
    allowedHosts: ["web"],
    proxy: {
      "/api": { target: handlersUrl, changeOrigin: false },
    },
  },
});
