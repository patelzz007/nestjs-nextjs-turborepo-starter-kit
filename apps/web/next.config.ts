import type { NextConfig } from "next";

import { LEGACY_REDIRECTS } from "./lib/legacy-redirects";
const withBundleAnalyzer = require("@next/bundle-analyzer")({
	enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
	transpilePackages: ["@workspace/api-client", "@workspace/client", "@workspace/ui", "@workspace/shared"],
	redirects: () => Promise.resolve([...LEGACY_REDIRECTS]),
};

export default withBundleAnalyzer(nextConfig);
