import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.reuters.com" },
      { protocol: "https", hostname: "**.bbc.co.uk" },
      { protocol: "https", hostname: "**.bbc.com" },
      { protocol: "https", hostname: "**.nytimes.com" },
      { protocol: "https", hostname: "**.wsj.com" },
      { protocol: "https", hostname: "**.apnews.com" },
      { protocol: "https", hostname: "**.theguardian.com" },
      // Catch-all for any other publisher OG images
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
