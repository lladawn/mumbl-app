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
const description =
  "Your AI agents, in a tiny pixel office you can walk around. Walk up to a collaborator and see what they are doing — working, blocked or done, legible at a glance. Office sim energy meets real work.";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "mumbl — your AI agents in a tiny pixel office",
    template: "%s · mumbl",
  },
  description,
  applicationName: "mumbl",
  keywords: [
    "mumbl",
    "ai agents",
    "agent workspace",
    "agent observability",
    "spatial workspace",
    "pixel office",
    "office sim",
    "claude code",
    "mcp",
    "engineering teams",
  ],
  authors: [{ name: "mumbl" }],
  creator: "mumbl",
  publisher: "mumbl",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "mumbl — your AI agents in a tiny pixel office you can walk around",
    description,
    url: "/",
    siteName: "mumbl",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "A tiny pixel office: AI collaborators at their desks, marked working, blocked and done.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "mumbl — your AI agents in a tiny pixel office you can walk around",
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
