// Babel for the Expo app: Expo's preset, exactly as Expo uses without a config
// file — plus, under Jest only, the dynamic-import transform. Metro bundles
// `import()` itself; Jest runs CommonJS and needs `import()` rewritten to a
// `require` (the dev-only demo-account list is loaded that way, ADR 042).
//
// `marked` keeps its named capture groups native under Jest too, as Metro's Hermes build
// does (babel/keep-native-named-groups.cjs): it splices regex sources together, which
// the named-group transform of a non-Hermes compile breaks.

/** @type {import("@babel/core").ConfigFunction} */
module.exports = function babelConfig(api) {
	api.cache.using(() => process.env.NODE_ENV);
	return {
		presets: ["babel-preset-expo"],
		plugins: ["./babel/keep-native-named-groups.cjs"],
		env: {
			test: {
				plugins: ["@babel/plugin-transform-dynamic-import"],
			},
		},
	};
};
