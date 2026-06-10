const MAX_ATTEMPTS = 12;
const RETRY_DELAY_MS = 250;
const SCROLL_MILESTONES = [50, 90];
const SAFE_DATA_KEYS = new Set([
  "action",
  "anonymous",
  "enabled",
  "kind",
  "label",
  "milestone",
  "opened",
  "reason",
  "source",
  "target",
  "type",
  "utm_campaign",
  "utm_medium",
  "utm_source",
  "vibe",
  "referrer_origin",
]);
const BLOCKED_DATA_KEYS = /content|description|display|email|handle|message|name|post|room|session|slug|text|token/i;
const SAFE_VALUE_MAX_LENGTH = 80;

export function trackEvent(name, data = {}, options = {}) {
  sendWhenReady(() => ({
    website: websiteId(),
    url: safePath(window.location.pathname),
    title: safeTitle(window.location.pathname),
    name,
    data: sanitiseEventData(options.includeContext ? { ...campaignContext(), ...data } : data),
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

export function trackPublicCta(target, data = {}) {
  if (typeof window === "undefined" || !isPublicPath(window.location.pathname)) return;
  trackEvent("public_cta_clicked", { target, ...data }, { includeContext: true });
}

export function trackDemoEntry(source = "unknown") {
  if (typeof window === "undefined" || !isPublicPath(window.location.pathname)) return;
  trackEvent("demo_entry_clicked", { source }, { includeContext: true });
}

export function trackConversionEvent(name, data = {}) {
  trackEvent(name, data, { includeContext: true });
}

export function trackPublicScrollMilestones(pathname) {
  if (typeof window === "undefined" || !isPublicPath(pathname)) return () => {};

  const seen = new Set();
  let ticking = false;

  function checkScroll() {
    ticking = false;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;

    const percent = Math.round((window.scrollY / scrollable) * 100);
    for (const milestone of SCROLL_MILESTONES) {
      if (percent >= milestone && !seen.has(milestone)) {
        seen.add(milestone);
        trackEvent("public_scroll_milestone", { milestone });
      }
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(checkScroll);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  checkScroll();
  return () => window.removeEventListener("scroll", onScroll);
}

function sendWhenReady(makePayload, attempt = 0) {
  if (typeof window === "undefined") return;
  if (!analyticsEnabled()) return;
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

function analyticsEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true";
}

function isPublicPath(pathname) {
  return pathname === "/" || pathname === "/create" || pathname === "/explore";
}

function sanitiseEventData(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key, value]) => isSafeDataKey(key) && ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, SAFE_VALUE_MAX_LENGTH) : value]),
  );
}

function isSafeDataKey(key) {
  return SAFE_DATA_KEYS.has(key) && !BLOCKED_DATA_KEYS.test(key);
}

function campaignContext() {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const context = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = params.get(key);
    if (value) context[key] = value;
  }

  const referrerOrigin = safeReferrerOrigin();
  if (referrerOrigin) context.referrer_origin = referrerOrigin;
  return context;
}

function safeReferrerOrigin() {
  if (!document.referrer) return "";

  try {
    const referrer = new URL(document.referrer);
    if (referrer.origin === window.location.origin) return "";
    return referrer.origin;
  } catch {
    return "";
  }
}
