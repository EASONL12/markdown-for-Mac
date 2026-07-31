import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// When running inside Electron, the window provides real vibrancy, so the
// page background must be transparent to let the native material show through.
// In a plain browser (vite preview) we fall back to an opaque chrome color.
if (window.plainmark) {
  document.documentElement.classList.add("vibrant");
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
