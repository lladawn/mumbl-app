/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.31.16"],
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
