/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable output file tracing symlinks — prevents EINVAL errors on OneDrive/network drives
  experimental: {
    outputFileTracingDisableSourceBase: true,
  },
};

module.exports = nextConfig;
