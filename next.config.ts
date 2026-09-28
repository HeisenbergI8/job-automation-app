import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // CVs and cover letters are uploaded through a server action. Vercel caps bodies at 4.5MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
