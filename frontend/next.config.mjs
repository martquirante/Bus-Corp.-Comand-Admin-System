/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@pos-bus/shared"],
  images: {
    unoptimized: true
  }
};

export default nextConfig;
