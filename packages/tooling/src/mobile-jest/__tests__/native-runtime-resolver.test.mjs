/**
 * The Jest resolution rule apps/mobile and packages/ui-native share
 * (packages/ui-native/jest/native-runtime-resolver.cjs): Reanimated and Worklets load their
 * JavaScript build under Jest, keyed on each library's real install folder — never on a
 * substring of the path, which pnpm's store folder names (`…_react-native-worklets@0.13.0_…`)
 * would match for every package that peers on Worklets. It is CommonJS that Jest loads in plain
 * Node, so it is checked here, in Node.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/** packages/ui-native, from packages/tooling/src/mobile-jest/__tests__. */
const UI_NATIVE_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..", "ui-native");

const require = createRequire(path.join(UI_NATIVE_ROOT, "package.json"));
const { createNativeRuntimeOptions, REANIMATED_WEB_ONLY_IN_JEST } = require("./jest/native-runtime-resolver.cjs");

/** What jest-expo resolves with for the `ios` platform. */
const IOS_EXTENSIONS = [".ios.ts", ".native.ts", ".ts", ".ios.js", ".native.js", ".js"];
/** The same with the `.native` files dropped — what both libraries' own resolvers do. */
const JAVASCRIPT_BUILD_EXTENSIONS = [".ios.ts", ".ts", ".ios.js", ".js"];

const REANIMATED_ROOT = path.dirname(require.resolve("react-native-reanimated/package.json"));
const WORKLETS_ROOT = path.dirname(require.resolve("react-native-worklets/package.json"));
/** A package beside them whose pnpm store folder names its Worklets peer, as expo-image's does. */
const PEER_NAMED_PACKAGE_ROOT = path.join(
	path.dirname(path.dirname(path.dirname(WORKLETS_ROOT))),
	"expo-image@58.0.17_react-native-worklets@0.13.0",
	"node_modules",
	"expo-image",
);

const nativeRuntimeOptions = createNativeRuntimeOptions(UI_NATIVE_ROOT);

function extensionsFor(request, basedir) {
	return nativeRuntimeOptions(request, { basedir, extensions: IOS_EXTENSIONS }).extensions;
}

describe("createNativeRuntimeOptions", () => {
	it("loads Reanimated's web-only files as the web build, and every other Reanimated file as the platform's", () => {
		const source = path.join(REANIMATED_ROOT, "src");

		expect(extensionsFor("./initializers", source)).toEqual(JAVASCRIPT_BUILD_EXTENSIONS);
		expect(extensionsFor("../css/component/AnimatedComponent", path.join(source, "createAnimatedComponent"))).toEqual(JAVASCRIPT_BUILD_EXTENSIONS);
		expect(extensionsFor("./ReducedMotion", source)).toEqual(IOS_EXTENSIONS);
		// A package import is not one of Reanimated's own files, even when it shares a name.
		expect(extensionsFor("util", source)).toEqual(IOS_EXTENSIONS);
	});

	it("loads Worklets as its web build, imported or from inside it", () => {
		expect(extensionsFor("react-native-worklets", UI_NATIVE_ROOT)).toEqual(JAVASCRIPT_BUILD_EXTENSIONS);
		expect(extensionsFor("react-native-worklets/src/mock", UI_NATIVE_ROOT)).toEqual(JAVASCRIPT_BUILD_EXTENSIONS);
		expect(extensionsFor("./threads", path.join(WORKLETS_ROOT, "src"))).toEqual(JAVASCRIPT_BUILD_EXTENSIONS);
	});

	it("leaves a package that only peers on Worklets alone, though pnpm names its folder after them", () => {
		expect(extensionsFor("./ExpoImage", path.join(PEER_NAMED_PACKAGE_ROOT, "build"))).toEqual(IOS_EXTENSIONS);
		expect(extensionsFor("./util", path.join(PEER_NAMED_PACKAGE_ROOT, "build"))).toEqual(IOS_EXTENSIONS);
		// A folder that merely starts with a library's folder name is not inside it.
		expect(extensionsFor("./initializers", `${REANIMATED_ROOT}-fork`)).toEqual(IOS_EXTENSIONS);
	});

	it("names Reanimated's web-only files as its own Jest resolver does", () => {
		const reanimatedResolver = require.resolve("react-native-reanimated/jest/resolver");
		const source = readFileSync(reanimatedResolver, "utf8");

		for (const entry of REANIMATED_WEB_ONLY_IN_JEST) {
			expect(source).toContain(`'${entry}'`);
		}
	});
});
