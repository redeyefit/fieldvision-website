"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (isStandalone()) return;
    if (typeof localStorage !== "undefined" && localStorage.getItem("pwa-install-dismissed")) return;

    if (isIOS()) {
      // Show iOS instructions after a short delay
      const timer = setTimeout(() => setShowIOSPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop — listen for beforeinstallprompt
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    try {
      localStorage.setItem("pwa-install-dismissed", "1");
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  if (dismissed || isStandalone()) return null;

  // Android/Desktop install banner
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-black/90 p-4 shadow-2xl backdrop-blur-sm border border-white/10">
        <div className="flex items-center gap-3">
          <img src="/icon-192x192.png" alt="FieldVision" className="h-12 w-12 rounded-xl" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Install FieldVision</p>
            <p className="text-white/60 text-xs">Add to home screen for the best experience</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20 transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
          >
            Install
          </button>
        </div>
      </div>
    );
  }

  // iOS install instructions
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-black/90 p-4 shadow-2xl backdrop-blur-sm border border-white/10">
        <div className="flex items-start gap-3">
          <img src="/icon-192x192.png" alt="FieldVision" className="h-12 w-12 rounded-xl" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Install FieldVision</p>
            <p className="text-white/60 text-xs mt-1">
              Tap{" "}
              <span className="inline-flex items-center">
                <svg className="h-4 w-4 inline text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </span>{" "}
              Share, then <strong className="text-white">Add to Home Screen</strong>
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
            aria-label="Dismiss"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
