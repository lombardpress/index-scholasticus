import type { NextConfig } from "next";

// Served from a subpath on GitHub Pages: lombardpress.org/index-scholasticus/.
// basePath prefixes both the /_next asset URLs and all <Link> hrefs so they
// resolve under the subpath. Applied only to the production export so `next dev`
// stays at http://localhost:3000/.
const isProd = process.env.NODE_ENV === "production";
const basePath = isProd ? "/index-scholasticus" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: {
    // Allow production builds to complete even with type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
