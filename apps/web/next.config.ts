import type { NextConfig } from "next";
const withBundleAnalyzer = require("@next/bundle-analyzer")({
	enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
	transpilePackages: ["@workspace/client", "@workspace/ui", "@workspace/shared"],
};

export default withBundleAnalyzer(nextConfig);
