const extraAllowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.31.16", ...extraAllowedDevOrigins],
  async rewrites() {
    return [
      {
        source: "/@:handle",
        destination: "/public/:handle",
      },
    ];
  },
};

export default nextConfig;
