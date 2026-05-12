const MAX_ATTEMPTS = 12;
const RETRY_DELAY_MS = 250;

export function trackEvent(name, data = {}) {
  sendWhenReady(() => ({
    website: websiteId(),
    url: safePath(window.location.pathname),
    title: safeTitle(window.location.pathname),
    name,
    data: sanitiseEventData(data),
  }));
}

export function trackPublicPageView(pathname) {
  if (typeof window === "undefined" || !isPublicPath(pathname)) return;

  sendWhenReady(() => ({
    website: websiteId(),
    url: pathname,
    title: document.title,
  }));
}

function sendWhenReady(makePayload, attempt = 0) {
  if (typeof window === "undefined") return;
  if (!websiteId()) return;

  if (window.umami?.track) {
    window.umami.track(makePayload());
    return;
  }

  if (attempt >= MAX_ATTEMPTS) return;
  window.setTimeout(() => sendWhenReady(makePayload, attempt + 1), RETRY_DELAY_MS);
}

function safePath(pathname) {
  if (pathname.startsWith("/r/")) return "/r/[space]";
  return isPublicPath(pathname) ? pathname : "/app";
}

function safeTitle(pathname) {
  if (pathname.startsWith("/r/")) return "mumbl room";
  return document.title || "mumbl";
}

function websiteId() {
  return process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || "";
}

function isPublicPath(pathname) {
  return pathname === "/" || pathname === "/create" || pathname === "/explore";
}

function sanitiseEventData(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)),
  );
}
