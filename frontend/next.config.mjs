import os from "node:os";

const localNetworkHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((network) => network?.family === "IPv4" && !network.internal)
  .map((network) => network.address);

const configuredDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next dev blocks cross-site access to internal _next resources by default.
  // Allow the machine's LAN IPs so http://<lan-ip>:3000 hydrates correctly.
  allowedDevOrigins: [...new Set([...localNetworkHosts, ...configuredDevOrigins])],
  transpilePackages: ["@pos-bus/shared"],
  images: {
    unoptimized: true
  }
};

export default nextConfig;
