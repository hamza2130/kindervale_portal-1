import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      "https://kindervale-backend.onrender.com/api",
  },
  // The real marketing site lives at kindervale.com; its own "Portal" button links straight
  // here, so this app's root has no landing-page job to do anymore -- send it directly to login
  // instead of rendering the placeholder landing page first.
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
