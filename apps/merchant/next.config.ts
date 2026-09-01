import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@workspace/client", "@workspace/ui", "@workspace/shared"],
};

export default nextConfig;
