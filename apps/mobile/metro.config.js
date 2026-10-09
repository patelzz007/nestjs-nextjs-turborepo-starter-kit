// Metro for the mobile app (docs/technical/mobile/mobile-app.md §9.2, §14.3).
//
// `expo/metro-config` already understands the pnpm workspace (it watches the
// workspace root and follows the symlinks), so there is no `watchFolders` /
// `extraNodeModules` here. Two resolution rules are added, both scoped:
//
// 1. Singletons. `react`, `react-native` and `@tanstack/react-query` must be ONE
//    instance in the bundle. A workspace package such as `@workspace/api-client`
//    keeps its own devDependency copies (the web's React 19.3) in its
//    node_modules, so its `import "react"` would otherwise load a second React
//    (invalid hook calls) and a second TanStack Query (no QueryClient in its
//    context). These imports always resolve from this app, whose versions are
//    the ones Expo SDK 57 pins.
// 2. `@workspace/*` packages resolve through their `development` export
//    (TypeScript source), like the Next apps and `tsc` do, so no stale `dist/`
//    is ever bundled and edits to the shared packages reload live.
//
// `withUniwindConfig` is the OUTERMOST wrapper (Uniwind requirement, ADR 032):
// it wraps our resolver and installs its own CSS transformer.

const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

/** Packages that must exist once in the bundle; resolved from this app. */
const SINGLETON_PACKAGES = ["react", "react-native", "@tanstack/react-query"];

/** Where a singleton import is resolved from: this app's own package.json. */
const APP_ORIGIN = path.join(__dirname, "package.json");

/** The export condition that points a workspace package at its TypeScript source. */
const WORKSPACE_SOURCE_CONDITION = "development";

const WORKSPACE_SCOPE = "@workspace/";

function isSingleton(moduleName) {
	return SINGLETON_PACKAGES.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (isSingleton(moduleName)) {
		return context.resolveRequest({ ...context, originModulePath: APP_ORIGIN }, moduleName, platform);
	}
	if (moduleName.startsWith(WORKSPACE_SCOPE)) {
		const conditionNames = [...context.unstable_conditionNames, WORKSPACE_SOURCE_CONDITION];
		return context.resolveRequest({ ...context, unstable_conditionNames: conditionNames }, moduleName, platform);
	}
	return context.resolveRequest(context, moduleName, platform);
};

module.exports = withUniwindConfig(config, {
	cssEntryFile: "./global.css",
	dtsFile: "./uniwind-types.d.ts",
});
