import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@workspace/api-client", "@workspace/client", "@workspace/ui", "@workspace/shared"],
};

export default nextConfig;
