import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");

try {
  createRoot(root!).render(<App />);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown startup error";

  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111111;color:#f5f5f5;padding:24px;font-family:system-ui,sans-serif;">
        <div style="max-width:720px;width:100%;background:#1b1b1b;border:1px solid #333;border-radius:16px;padding:24px;">
          <h1 style="margin:0 0 12px;font-size:28px;">App startup failed</h1>
          <p style="margin:0 0 12px;line-height:1.6;color:#d4d4d4;">
            The production app could not start. This usually means the Netlify environment variables are missing or incorrect.
          </p>
          <pre style="white-space:pre-wrap;word-break:break-word;background:#101010;border-radius:12px;padding:16px;color:#ffb4b4;">${message}</pre>
        </div>
      </div>
    `;
  }

  throw error;
}
