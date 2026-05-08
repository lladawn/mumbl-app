export default function sitemap() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://justmumbl.vercel.app";

  return [
    {
      url: appUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${appUrl}/create`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
