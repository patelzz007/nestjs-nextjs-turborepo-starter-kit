// Under Jest, Reanimated and Worklets run their JavaScript implementations, not
// their native ones: some of their files must load as the web build even though
// jest-expo resolves for the `ios` platform (`.ios.ts` / `.native.ts` first).
// Reanimated 4.7's native initializer, for one, calls into the native CSS module,
// which does not exist under Jest.
//
// Both libraries ship a Jest resolver for this (`react-native-reanimated/jest/resolver`,
// which chains `react-native-worklets/jest/resolver`), but they recognise their own
// files with `basedir.includes("react-native-worklets")`. pnpm puts a package's
// peers in its store folder name (`react-native-reanimated@4.7.1_react-native-worklets@0.13.0_…`,
// `expo-image@…_react-native-worklets@…`), so that check matches every package that
// peers on Worklets and loads their web builds too (Reanimated's `matchMedia`
// reduced-motion probe, expo-image's web view). This applies the same two rules,
// keyed on each library's real install folder instead.
//
// Used by apps/mobile/jest.resolver.cjs and packages/ui-native/jest.resolver.cjs.

const path = require("node:path");

/**
 * Reanimated's files that run their web build under Jest — the list in
 * react-native-reanimated@4.7.1's `jest/resolver.js`. Re-check it when Reanimated
 * is upgraded. An entry with a `/` names the file by its path ending.
 */
const REANIMATED_WEB_ONLY_IN_JEST = [
	"initializers",
	"mutables",
	"mappers",
	"ConfigHelper",
	"UpdateLayoutAnimations",
	"useAnimatedRef",
	"useAnimatedStyle",
	"WorkletEventHandler",
	"JSPropsUpdater",
	"updateProps",
	"util",
	"css/component/AnimatedComponent",
];

const REANIMATED = "react-native-reanimated";
const WORKLETS = "react-native-worklets";

/** The folder a package is installed in, as resolved from `fromDirectory` (pnpm's real store path). */
function packageRoot(name, fromDirectory) {
	return path.dirname(require.resolve(`${name}/package.json`, { paths: [fromDirectory] }));
}

function isInside(directory, root) {
	return directory === root || directory.startsWith(`${root}${path.sep}`);
}

function isReanimatedWebOnly(request) {
	const basename = path.posix.basename(request);
	return REANIMATED_WEB_ONLY_IN_JEST.some((entry) => (entry.includes("/") ? request.endsWith(entry) : basename === entry));
}

function withoutNativeExtensions(options) {
	return { ...options, extensions: options.extensions?.filter((extension) => !extension.includes("native")) };
}

/**
 * Builds the rule for one Jest project: given a request and Jest's resolver
 * options, returns the options to resolve it with — the platform's `.native`
 * extensions dropped where Reanimated or Worklets run their JavaScript build,
 * unchanged everywhere else.
 */
function createNativeRuntimeOptions(fromDirectory) {
	const reanimatedRoot = packageRoot(REANIMATED, fromDirectory);
	const workletsRoot = packageRoot(WORKLETS, fromDirectory);
	return (request, options) => {
		const isWorkletsRequest = request === WORKLETS || request.startsWith(`${WORKLETS}/`);
		if (isWorkletsRequest || isInside(options.basedir, workletsRoot)) {
			return withoutNativeExtensions(options);
		}
		if (request.startsWith(".") && isInside(options.basedir, reanimatedRoot) && isReanimatedWebOnly(request)) {
			return withoutNativeExtensions(options);
		}
		return options;
	};
}

module.exports = { createNativeRuntimeOptions, REANIMATED_WEB_ONLY_IN_JEST };
