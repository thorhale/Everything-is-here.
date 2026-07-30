"use client";

import { useEffect, useState } from "react";

// Registers the service worker and surfaces an "Install" button.
//
// Chrome/Edge/Android fire `beforeinstallprompt` when the app meets the
// install criteria; we stash the event and call prompt() on a real click,
// because browsers require a user gesture. iOS Safari never fires it and has no
// programmatic install at all — there we show the Share-sheet instructions
// instead, since silently rendering nothing on iPhone would be the wrong call.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "wh-install-dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we check

  useEffect(() => {
    // Register the worker. Failure is non-fatal — the site works fine without it.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Already installed (standalone display mode)? Never nag.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari's non-standard flag
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // localStorage can throw in private mode; treat as not dismissed.
    }
    setDismissed(false);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's own mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS: no beforeinstallprompt ever. Detect iPhone/iPad + Safari.
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) setIosHint(true);

    const onInstalled = () => setDeferred(null);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function close() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — it'll just reappear next visit */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "dismissed") close();
  }

  if (dismissed) return null;
  if (!deferred && !iosHint) return null;

  return (
    <div
      role="complementary"
      aria-label="Install WortHogg"
      style={{
        position: "fixed",
        bottom: "1rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        width: "min(30rem, calc(100vw - 2rem))",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.7rem 0.85rem",
        background: "#fff",
        border: "1px solid var(--wh-border)",
        borderRadius: 10,
        boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/icon-192.png" alt="" width={40} height={40} style={{ flex: "0 0 auto", borderRadius: 8 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: "0.9rem" }}>Install WortHogg</strong>
        <span style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
          {deferred
            ? "Add it to your home screen — full screen, own icon, opens like an app."
            : "Tap Share, then “Add to Home Screen”."}
        </span>
      </div>
      {deferred && (
        <button type="button" onClick={install} className="wh-btn" style={{ flex: "0 0 auto", cursor: "pointer" }}>
          Install
        </button>
      )}
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        style={{
          flex: "0 0 auto",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1.15rem",
          lineHeight: 1,
          color: "var(--wh-text-light)",
          padding: "0.2rem 0.3rem",
        }}
      >
        ×
      </button>
    </div>
  );
}
