// NestJS 12 + Fastify — Rspack bundle (SWC decorators, Node ESM, external deps).
// Mode comes from the CLI (`--mode development` / `--mode production`), not NODE_ENV.
import path from "node:path";

import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { RunScriptWebpackPlugin } from "run-script-webpack-plugin";
import nodeExternals from "webpack-node-externals";

/**
 * Workspace packages the API loads from their built `dist/` at runtime (node externals keep them
 * out of the bundle). In dev their own `tsc --watch` keeps `dist/` current (decision #69), but rspack
 * never watches externals, so without this the API keeps running stale code after an edit in
 * `packages/shared`. Registering each `dist/` as a context dependency makes rspack rebuild, and
 * RunScriptWebpackPlugin restart the API, whenever one of them is re-emitted. (rspack's
 * `watchOptions` has no way to add watched paths; verified against @rspack/core 2.2.8.)
 */
const WATCHED_WORKSPACE_DIST_DIRS = ["shared", "messaging", "api-client"].map((name) => path.resolve(import.meta.dirname, "..", "..", "packages", name, "dist"));

class WatchWorkspaceDistPlugin {
	apply(compiler) {
		compiler.hooks.thisCompilation.tap("WatchWorkspaceDistPlugin", (compilation) => {
			for (const directory of WATCHED_WORKSPACE_DIST_DIRS) {
				compilation.contextDependencies.add(directory);
			}
		});
	}
}

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
			}),
		],
		plugins: [
			...(isDev
				? [
						new WatchWorkspaceDistPlugin(),
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
