import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Fix kuromoji dictionary URLs (path.join strips https:// in browser builds)
        source: "/cdn.jsdelivr.net/:path*",
        destination: "https://cdn.jsdelivr.net/:path*",
      },
    ];
  },
};

export default nextConfig;
