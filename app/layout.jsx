import Script from "next/script";
import { Press_Start_2P } from "next/font/google";
import AnalyticsTracker from "../src/components/AnalyticsTracker";
import AppShell from "../src/components/AppShell";
import "../styles.css";

// bitmap display font for headings, labels, buttons, nav. body stays Inter.
const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mumbl.wtf";
const analyticsEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true";
const umamiScriptSrc = process.env.NEXT_PUBLIC_UMAMI_SRC || "https://breathe-umami.vercel.app/script.js";
const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || "";
// THE LINE THAT TRAVELS. This string and the title below are what every share,
// unfurl and search result shows, whatever any page says — so they are the last
// place the retired pitch ("your AI agents in a tiny pixel office") was still
// alive. The product is your own workday as a world; agents are real and stay,
// but as the closing clause rather than the headline. The title is deliberately
// WORD FOR WORD the homepage hero line: the title is what gets clicked, the hero
// is what confirms the click was right, and if they differ the visitor feels a
// bait-and-switch in the first second. Change them together or not at all.
const title = "mumbl — your workday, rendered as a world";
const description =
  "Your apps become a pixel world you can walk around — Figma is an easel, Spotify a turntable, a call lights up the meeting room. Agents get desks too.";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: title,
    template: "%s · mumbl",
  },
  description,
  applicationName: "mumbl",
  keywords: [
    "mumbl",
    "pixel office",
    "office sim",
    "workday visualization",
    "day recap",
    "wrapped for work",
    "shareable pixel art",
    "macOS menubar app",
    // last two on purpose: still true, still findable, no longer the pitch
    "ai agents",
    "claude code",
  ],
  authors: [{ name: "mumbl" }],
  creator: "mumbl",
  publisher: "mumbl",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "mumbl",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "A pixel office seen from above: desks drawn from the apps someone is using, a café, and a rec room with a ping-pong table.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/twitter-image"],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "slack-app-id": "A0B9JPJGT2S",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={pixelFont.variable}>
      <body>
        <AppShell>{children}</AppShell>
        {analyticsEnabled && umamiWebsiteId ? <AnalyticsTracker /> : null}
        {analyticsEnabled && umamiWebsiteId ? (
          <Script
            defer
            src={umamiScriptSrc}
            data-website-id={umamiWebsiteId}
            data-auto-track="false"
            data-do-not-track="true"
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
