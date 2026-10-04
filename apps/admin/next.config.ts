import type { NextConfig } from "next";

import { LEGACY_ROUTE_REDIRECTS, type LegacyRouteRedirect } from "./lib/navigation/legacy-redirects";

const withBundleAnalyzer = require("@next/bundle-analyzer")({
	enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
	transpilePackages: ["@workspace/client", "@workspace/ui", "@workspace/shared"],
	images: {
		// Cover art for the `/docs` banners is served from Unsplash's CDN.
		remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
	},
	// Renamed pages answer their old URLs with a 308 (lib/navigation/legacy-redirects.ts).
	redirects: (): Promise<LegacyRouteRedirect[]> => Promise.resolve([...LEGACY_ROUTE_REDIRECTS]),
};

export default withBundleAnalyzer(nextConfig);
