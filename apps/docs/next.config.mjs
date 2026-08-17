import { createMDX } from "fumadocs-mdx/next";

/** @type {import("next").NextConfig} */
const nextConfig = {
	transpilePackages: ["@workspace/ui"],
	// The guides are heavy (mermaid, big markdown files) and a full rebuild
	// re-renders every page at once, which can exceed Next's default 60s
	// per-page budget under load. Give each page a generous timeout.
	staticPageGenerationTimeout: 300,
	images: {
		// Cover-art banners in the guides are served from Unsplash's CDN.
		remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
	},
};

const withMDX = createMDX();

export default withMDX(nextConfig);
