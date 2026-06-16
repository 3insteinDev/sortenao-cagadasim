/**
 * Guarded PWA service-worker registration.
 * Only registers in production on the real published domain.
 * Never registers in Lovable preview/dev/iframe contexts.
 */
export function registerPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const isDev = !import.meta.env.PROD;
  const isIframe = window.self !== window.top;
  const host = location.hostname;

  // Lovable preview / dev hostnames
  const isPreview =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  const swOff = new URLSearchParams(location.search).get("sw") === "off";

  const shouldRegister = !isDev && !isIframe && !isPreview && !swOff;

  if (!shouldRegister) {
    // Unregister any stale app-shell SW before returning
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) =>
        regs.filter((r) => r.scope === location.origin + "/").forEach((r) => r.unregister()),
      )
      .catch(() => {});
    return;
  }

  // Register the generated /sw.js
  navigator.serviceWorker
    .register("/sw.js")
    .catch((err) => console.error("SW registration failed:", err));
}
