import { nextJsConfig } from "@workspace/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
export default [
	...nextJsConfig,
	{
		// `fumadocs-mdx` generates `.source/*` (config bundle + runtime entry
		// points) on every build — generated code, not ours to lint.
		ignores: [".source/**"],
	},
	{
		// Docs screenshots are static MDX assets rendered at natural size inside
		// the lightbox; `next/image` optimization/sizing does not apply to them.
		files: ["components/docs-image.tsx", "components/image-gallery.tsx"],
		rules: {
			"@next/next/no-img-element": "off",
		},
	},
];
