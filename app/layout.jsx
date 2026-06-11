import Script from "next/script";
import AnalyticsTracker from "../src/components/AnalyticsTracker";
import AppShell from "../src/components/AppShell";
import "../styles.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mumbl.wtf";
const analyticsEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true";
const umamiScriptSrc = process.env.NEXT_PUBLIC_UMAMI_SRC || "https://breathe-umami.vercel.app/script.js";
const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || "";
const description =
  "Mumbl lets teams save private thoughts from Slack with /mumbl, shape useful ones into field notes, and publish team reads only by choice.";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "mumbl",
    template: "%s · mumbl",
  },
  description,
  applicationName: "mumbl",
  keywords: [
    "mumbl",
    "slack private notes",
    "team reads",
    "field notes",
    "engineering teams",
    "team heartbeat",
    "work culture",
  ],
  authors: [{ name: "mumbl" }],
  creator: "mumbl",
  publisher: "mumbl",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "mumbl - save what you're thinking before you polish what you say",
    description,
    url: "/",
    siteName: "mumbl",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "mumbl - save what you're thinking before you polish what you say",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "mumbl - save what you're thinking before you polish what you say",
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
    <html lang="en">
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
