// Babel for the Expo app: Expo's preset, exactly as Expo uses without a config
// file — plus, under Jest only, the dynamic-import transform. Metro bundles
// `import()` itself; Jest runs CommonJS and needs `import()` rewritten to a
// `require` (the dev-only demo-account list is loaded that way, ADR 042).

/** @type {import("@babel/core").ConfigFunction} */
module.exports = function babelConfig(api) {
	api.cache.using(() => process.env.NODE_ENV);
	return {
		presets: ["babel-preset-expo"],
		env: {
			test: {
				plugins: ["@babel/plugin-transform-dynamic-import"],
			},
		},
	};
};
