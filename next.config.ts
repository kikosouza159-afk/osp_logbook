import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["read-excel-file", "unzipper"],
};

export default nextConfig;
