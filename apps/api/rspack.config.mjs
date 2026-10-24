// NestJS 12 + Fastify — Rspack bundle (SWC decorators, Node ESM, external deps).
// Mode comes from the CLI (`--mode development` / `--mode production`), not NODE_ENV.

import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { RunScriptWebpackPlugin } from "run-script-webpack-plugin";
import nodeExternals from "webpack-node-externals";

/**
 * In development the API bundles `@workspace/*` from their TypeScript source, through the
 * `development` export condition — as the Next apps, Metro and `tsc` (customConditions) already do.
 * So `dev` needs no built `dist/` of those packages (no `^build` before it: apps/api/turbo.json), and
 * an edit in `packages/shared` rebuilds and restarts the API directly, being part of the bundle.
 * Their npm dependencies stay external: whatever they import at runtime must be a dependency of
 * this app too (resolved from apps/api/node_modules). Production keeps loading the built `dist/`.
 */
const WORKSPACE_PACKAGES = /^@workspace\//u;
const WORKSPACE_SOURCE_CONDITION = "development";

export default defineConfig((_env, argv) => {
	const isDev = argv.mode === "development";

	return {
		context: import.meta.dirname,
		target: "node",
		mode: argv.mode,
		entry: {
			main: "./src/main.ts",
		},
		output: {
			clean: true,
			filename: "main.js",
			module: true,
			chunkFormat: "module",
			// Files referenced by `new URL("<file>", import.meta.url)` (the PDF report fonts and their
			// licences) are emitted here, next to main.js, and resolved relative to the bundle at runtime.
			assetModuleFilename: "assets/[name].[contenthash:8][ext]",
		},
		resolve: {
			extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
			conditionNames: isDev ? [WORKSPACE_SOURCE_CONDITION, "..."] : ["..."],
		},
		module: {
			rules: [
				{
					test: /\.ts$/,
					exclude: [/node_modules/],
					use: {
						loader: "builtin:swc-loader",
						options: {
							detectSyntax: "auto",
							jsc: {
								target: "es2022",
								keepClassNames: true,
								parser: {
									syntax: "typescript",
									decorators: true,
									dynamicImport: true,
								},
								transform: {
									legacyDecorator: true,
									decoratorMetadata: true,
								},
							},
							module: {
								type: "es6",
							},
						},
					},
				},
				{
					test: /\.node$/,
					type: "asset/resource",
				},
			],
		},
		devtool: isDev ? "cheap-module-source-map" : "source-map",
		optimization: {
			splitChunks: false,
			minimize: !isDev,
			minimizer: [
				new rspack.SwcJsMinimizerRspackPlugin({
					minimizerOptions: {
						// Nest execution-context metadata relies on stable class/function names.
						compress: {
							keep_classnames: true,
							keep_fnames: true,
						},
						mangle: {
							keep_classnames: true,
							keep_fnames: true,
						},
					},
				}),
			],
		},
		externals: [
			nodeExternals({
				importType: "module",
				allowlist: isDev ? [WORKSPACE_PACKAGES] : [],
			}),
		],
		plugins: [
			...(isDev
				? [
						new RunScriptWebpackPlugin({
							name: "main.js",
							autoRestart: true,
							// SIGTERM lets Nest run shutdown hooks before rspack restarts the child.
							signal: "SIGTERM",
						}),
					]
				: [
						new rspack.DefinePlugin({
							"process.env.NODE_ENV": JSON.stringify("production"),
						}),
					]),
		],
		stats: "errors-warnings",
	};
});
