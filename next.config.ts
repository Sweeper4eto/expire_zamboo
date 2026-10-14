import type { NextConfig } from "next";

const fromEnv =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

// Phone LAN testing needs the LAN IP; without it, Next can block /_next assets
// and you get a white screen after login.
const nextConfig: NextConfig = {
  reactCompiler: true,
  // Production VPS builds (4GB) OOM during Next's typecheck; validate runs tsc locally.
  typescript: {
    ignoreBuildErrors: process.env.MAGAZIN_SKIP_TYPECHECK === "1",
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.1.112",
    "192.168.1.211",
    // Any host on the home LAN (phone testing over Wi‑Fi).
    "192.168.1.*",
    ...fromEnv,
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    }
    return config;
  },
};

export default nextConfig;
