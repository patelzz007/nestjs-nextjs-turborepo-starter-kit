import type { NextConfig } from "next";
const withBundleAnalyzer = require("@next/bundle-analyzer")({
	enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
	transpilePackages: ["@workspace/client", "@workspace/ui", "@workspace/shared"],
	images: {
		// Cover art for the `/docs` banners is served from Unsplash's CDN.
		remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
	},
};

export default withBundleAnalyzer(nextConfig);
