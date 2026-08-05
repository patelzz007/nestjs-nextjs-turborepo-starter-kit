import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@workspace/client", "@workspace/reactive", "@workspace/ui", "@workspace/shared"],
	images: {
		// Cover art for the `/docs` banners is served from Unsplash's CDN.
		remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
	},
};

export default nextConfig;
