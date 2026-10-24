// Jest's twin of the two resolution rules in metro.config.js, so tests load
// exactly the modules the app bundle loads.

const path = require("node:path");

/** Packages that must exist once: resolved from this app (see metro.config.js). */
const SINGLETON_PACKAGES = [
	"react",
	"react-native",
	"@tanstack/react-query",
	// Imported by the UI kit (packages/ui-native) too: native modules and runtime
	// state (Uniwind's theme, Reanimated's worklets) must be this app's one copy.
	"uniwind",
	"react-native-reanimated",
	"react-native-worklets",
	"react-native-svg",
	"react-native-safe-area-context",
	"react-native-keyboard-controller",
	"lucide-react-native",
	"expo-haptics",
	"expo-image",
];

/** The export condition that points a workspace package at its TypeScript source. */
const WORKSPACE_SOURCE_CONDITION = "development";

const WORKSPACE_SCOPE = "@workspace/";

const { createNativeRuntimeOptions } = require("@workspace/ui-native/jest/native-runtime-resolver");

/** Reanimated and Worklets run their JavaScript build under Jest (see native-runtime-resolver.cjs). */
const nativeRuntimeOptions = createNativeRuntimeOptions(__dirname);

/**
 * Packages whose React Native build is ES modules only, which Jest would have to
 * transpile out of node_modules. Tests load the same release's CommonJS build
 * (its `require` export) instead: the same code in a format Jest runs as is.
 */
const COMMONJS_UNDER_TEST_PACKAGES = ["lucide-react-native"];

/** The export conditions that select an ES module build. */
const ES_MODULE_CONDITIONS = new Set(["react-native", "import", "browser"]);

function isCommonJsUnderTest(request) {
	return COMMONJS_UNDER_TEST_PACKAGES.some((name) => request === name || request.startsWith(`${name}/`));
}

function isSingleton(request) {
	return SINGLETON_PACKAGES.some((name) => request === name || request.startsWith(`${name}/`));
}

/** Lucide's CommonJS build in place of its ES-module one (see COMMONJS_UNDER_TEST_PACKAGES). */
function commonJsConditions(options) {
	return ["require", ...(options.conditions ?? []).filter((condition) => !ES_MODULE_CONDITIONS.has(condition))];
}

module.exports = (request, jestOptions) => {
	const options = nativeRuntimeOptions(request, jestOptions);
	if (isSingleton(request)) {
		const fromApp = { ...options, basedir: path.resolve(__dirname) };
		return options.defaultResolver(request, isCommonJsUnderTest(request) ? { ...fromApp, conditions: commonJsConditions(options) } : fromApp);
	}
	if (request.startsWith(WORKSPACE_SCOPE)) {
		return options.defaultResolver(request, { ...options, conditions: [...(options.conditions ?? []), WORKSPACE_SOURCE_CONDITION] });
	}
	if (isCommonJsUnderTest(request)) {
		return options.defaultResolver(request, { ...options, conditions: commonJsConditions(options) });
	}
	return options.defaultResolver(request, options);
};
