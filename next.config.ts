import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Increase body size limit to handle large file uploads
      // 20MB file becomes ~27MB in base64, so we set limit to 30MB for safety
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
