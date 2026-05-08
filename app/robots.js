export default function robots() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://justmumbl.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
