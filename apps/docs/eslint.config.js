import { nextJsConfig } from "@workspace/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
export default [
	...nextJsConfig,
	{
		// `fumadocs-mdx` generates `.source/*` (config bundle + runtime entry
		// points) on every build — generated code, not ours to lint.
		ignores: [".source/**"],
	},
];
