// The kit's twin of apps/mobile/jest.resolver.cjs: workspace packages load
// from their TypeScript source (the `development` export, as Metro does), and
// Lucide's ES-module React Native build is swapped for the same release's
// CommonJS build, which Jest runs without transpiling node_modules.

/** The export condition that points a workspace package at its TypeScript source. */
const WORKSPACE_SOURCE_CONDITION = "development";

const WORKSPACE_SCOPE = "@workspace/";

const { createNativeRuntimeOptions } = require("./jest/native-runtime-resolver.cjs");

/** Reanimated and Worklets run their JavaScript build under Jest (see native-runtime-resolver.cjs). */
const nativeRuntimeOptions = createNativeRuntimeOptions(__dirname);

/** Packages whose React Native build is ES modules only; tests load their CommonJS build. */
const COMMONJS_UNDER_TEST_PACKAGES = ["lucide-react-native"];

/** The export conditions that select an ES module build. */
const ES_MODULE_CONDITIONS = new Set(["react-native", "import", "browser"]);

function isCommonJsUnderTest(request) {
	return COMMONJS_UNDER_TEST_PACKAGES.some((name) => request === name || request.startsWith(`${name}/`));
}

module.exports = (request, jestOptions) => {
	const options = nativeRuntimeOptions(request, jestOptions);
	if (request.startsWith(WORKSPACE_SCOPE)) {
		return options.defaultResolver(request, { ...options, conditions: [...(options.conditions ?? []), WORKSPACE_SOURCE_CONDITION] });
	}
	if (isCommonJsUnderTest(request)) {
		return options.defaultResolver(request, {
			...options,
			conditions: ["require", ...(options.conditions ?? []).filter((condition) => !ES_MODULE_CONDITIONS.has(condition))],
		});
	}
	return options.defaultResolver(request, options);
};
