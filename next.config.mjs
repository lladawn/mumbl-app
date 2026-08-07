const extraAllowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.31.16", ...extraAllowedDevOrigins],
  async redirects() {
    return [
      {
        // /vision moved under the slack product story; it is indexed, so keep
        // the old URL working.
        source: "/vision",
        destination: "/slack/vision",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/@:handle",
        destination: "/public/:handle",
      },
      {
        // the agent-collaborator demo is a static Phaser page in public/demo.
        // Next does not resolve directory index.html on its own.
        source: "/demo",
        destination: "/demo/index.html",
      },
    ];
  },
};

export default nextConfig;
