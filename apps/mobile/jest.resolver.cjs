// Jest's twin of the two resolution rules in metro.config.js, so tests load
// exactly the modules the app bundle loads.

const path = require("node:path");

/** Packages that must exist once: resolved from this app (see metro.config.js). */
const SINGLETON_PACKAGES = ["react", "react-native", "@tanstack/react-query"];

/** The export condition that points a workspace package at its TypeScript source. */
const WORKSPACE_SOURCE_CONDITION = "development";

const WORKSPACE_SCOPE = "@workspace/";

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

module.exports = (request, options) => {
	if (isSingleton(request)) {
		return options.defaultResolver(request, { ...options, basedir: path.resolve(__dirname) });
	}
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
