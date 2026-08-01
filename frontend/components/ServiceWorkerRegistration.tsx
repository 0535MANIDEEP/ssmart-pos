"use client";

import { useEffect } from "react";
import { startSyncLoop, syncDataFromServer, syncOutbox } from "@/lib/offline-sync";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates every hour
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch(() => {});

    // Start the sync loop
    startSyncLoop();

    // Initial data sync when online
    if (navigator.onLine) {
      syncDataFromServer();
    }

    // Sync data + outbox when coming back online
    const handleOnline = () => {
      syncDataFromServer();
      setTimeout(() => syncOutbox(), 2000);
    };
    window.addEventListener("online", handleOnline);

    // Listen for sync triggers from service worker
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_START") {
        syncOutbox();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSWMessage);

    return () => {
      window.removeEventListener("online", handleOnline);
      navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
    };
  }, []);

  return null;
}
