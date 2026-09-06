"use client";
import { useEffect } from "react";
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        // Offline support is optional; a failed registration must not break the app.
      });
    }
  }, []);
  return null;
}
