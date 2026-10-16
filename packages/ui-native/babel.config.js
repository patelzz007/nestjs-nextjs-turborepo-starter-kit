// Babel for the React Native UI kit's own tests: Expo's preset, exactly as the
// app (apps/mobile) compiles these files when it bundles them.

/** @type {import("@babel/core").ConfigFunction} */
module.exports = function babelConfig(api) {
	api.cache.using(() => process.env.NODE_ENV);
	return { presets: ["babel-preset-expo"] };
};
