// NestJS 12 + Fastify — Rspack bundle (SWC decorators, Node ESM, external deps).
// Mode comes from the CLI (`--mode development` / `--mode production`), not NODE_ENV.
import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { RunScriptWebpackPlugin } from "run-script-webpack-plugin";
import nodeExternals from "webpack-node-externals";

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
		devtool: "source-map",
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
