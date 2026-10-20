import type { NextConfig } from "next";

import { LEGACY_TENANT_REDIRECTS } from "./lib/navigation/legacy-tenant-redirects";

const withBundleAnalyzer = require("@next/bundle-analyzer")({
	enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
	transpilePackages: ["@workspace/api-client", "@workspace/client", "@workspace/ui", "@workspace/shared"],
	redirects: async () => [...LEGACY_TENANT_REDIRECTS],
};

export default withBundleAnalyzer(nextConfig);
