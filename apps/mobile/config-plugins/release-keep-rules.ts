// ============================================
// release-keep-rules.ts - an Expo config plugin for Android release builds
// ============================================
// A release build is shrunk by R8 (`android.enableMinifyInReleaseBuilds`),
// which renames and removes classes that no code refers to by name. Some
// native code finds classes at runtime by their name, so a release build
// behaved differently from a debug build: error codes changed, and Google's
// code scanner was reported missing. The keep rules, with the reason for
// each, are in release-keep-rules.pro (next to this file); this plugin adds
// that file to the release build's ProGuard files in app/build.gradle.
//
// The Gradle block sits between generated markers, so running prebuild again
// replaces it instead of adding a second one. Registered in app.config.ts by
// its path (`plugins`); it runs only when the native project is generated
// (`expo prebuild`, `expo run:android`, EAS Build). Expo Go never reads it.

import { withAppBuildGradle, type ConfigPlugin } from "expo/config-plugins";

/** The keep rules file, in the app's `config-plugins/` folder (Gradle's root project is `android/`, one level below the app). */
export const RELEASE_KEEP_RULES_PATH = "../config-plugins/release-keep-rules.pro";

/** The lines that open and close the block this plugin writes into app/build.gradle. */
export const RELEASE_KEEP_RULES_BLOCK_START = "// @generated begin release-keep-rules";
export const RELEASE_KEEP_RULES_BLOCK_END = "// @generated end release-keep-rules";

/** The Gradle block that adds the keep rules to the release build (Gradle merges it into the `android` block above it). */
export const RELEASE_KEEP_RULES_BLOCK = [
	RELEASE_KEEP_RULES_BLOCK_START,
	"android {",
	"    buildTypes {",
	"        release {",
	`            proguardFile rootProject.file("${RELEASE_KEEP_RULES_PATH}")`,
	"        }",
	"    }",
	"}",
	RELEASE_KEEP_RULES_BLOCK_END,
].join("\n");

/** `indexOf`'s answer when the text is not there. */
const NOT_FOUND = -1;

/** app/build.gradle with the keep-rules block at its end: added once, or put in place of the block a previous prebuild wrote. */
export function withReleaseKeepRules(buildGradle: string): string {
	const start = buildGradle.indexOf(RELEASE_KEEP_RULES_BLOCK_START);
	const end = buildGradle.indexOf(RELEASE_KEEP_RULES_BLOCK_END);
	const withoutBlock = start === NOT_FOUND || end < start ? buildGradle : buildGradle.slice(0, start) + buildGradle.slice(end + RELEASE_KEEP_RULES_BLOCK_END.length);
	return `${withoutBlock.trimEnd()}\n\n${RELEASE_KEEP_RULES_BLOCK}\n`;
}

export const withReleaseKeepRulesPlugin: ConfigPlugin = (config) =>
	withAppBuildGradle(config, (modConfig) => {
		modConfig.modResults.contents = withReleaseKeepRules(modConfig.modResults.contents);
		return modConfig;
	});

export default withReleaseKeepRulesPlugin;
