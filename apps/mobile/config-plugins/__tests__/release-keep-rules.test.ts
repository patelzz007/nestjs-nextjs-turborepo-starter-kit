import { z } from "zod";

import withReleaseKeepRulesPluginDefault, {
	RELEASE_KEEP_RULES_BLOCK,
	RELEASE_KEEP_RULES_BLOCK_END,
	RELEASE_KEEP_RULES_BLOCK_START,
	RELEASE_KEEP_RULES_PATH,
	withReleaseKeepRules,
	withReleaseKeepRulesPlugin,
} from "../release-keep-rules";

/** The end of a generated app/build.gradle (the release build type is declared above it). */
const BUILD_GRADLE = ["android {", "    buildTypes {", "        release {", "            minifyEnabled true", "        }", "    }", "}", ""].join("\n");

/** How many times `part` occurs in `text`. */
function occurrences(text: string, part: string): number {
	return text.split(part).length - 1;
}

describe("withReleaseKeepRules", () => {
	it("adds the keep rules file to the release build, after everything already there", () => {
		const gradle = withReleaseKeepRules(BUILD_GRADLE);

		expect(gradle).toBe(`${BUILD_GRADLE.trimEnd()}\n\n${RELEASE_KEEP_RULES_BLOCK}\n`);
		expect(gradle).toContain(`proguardFile rootProject.file("${RELEASE_KEEP_RULES_PATH}")`);
	});

	it("is idempotent across repeated prebuilds: one block, the same file", () => {
		const once = withReleaseKeepRules(BUILD_GRADLE);

		expect(withReleaseKeepRules(once)).toBe(once);
		expect(occurrences(withReleaseKeepRules(once), RELEASE_KEEP_RULES_BLOCK_START)).toBe(1);
	});

	it("replaces a block an earlier version of the plugin wrote", () => {
		const outdated = `${BUILD_GRADLE}\n${RELEASE_KEEP_RULES_BLOCK_START}\nandroid { }\n${RELEASE_KEEP_RULES_BLOCK_END}\n`;

		expect(withReleaseKeepRules(outdated)).toBe(withReleaseKeepRules(BUILD_GRADLE));
	});

	it("leaves a lone end marker in place and still adds one whole block", () => {
		const gradle = withReleaseKeepRules(`${BUILD_GRADLE}${RELEASE_KEEP_RULES_BLOCK_END}\n`);

		expect(occurrences(gradle, RELEASE_KEEP_RULES_BLOCK_START)).toBe(1);
		expect(gradle.endsWith(`${RELEASE_KEEP_RULES_BLOCK}\n`)).toBe(true);
	});
});

/** A config carrying an app/build.gradle mod (`ExpoConfig`'s type does not declare `mods`). */
const AppBuildGradleModSchema = z.object({ mods: z.object({ android: z.object({ appBuildGradle: z.instanceof(Function) }) }) });

describe("withReleaseKeepRulesPlugin", () => {
	it("registers an app/build.gradle change, and is the file's default export (app.config.ts loads it by path)", () => {
		const config = withReleaseKeepRulesPlugin({ name: "Starter", slug: "starter" });

		expect(AppBuildGradleModSchema.safeParse(config).success).toBe(true);
		expect(withReleaseKeepRulesPluginDefault).toBe(withReleaseKeepRulesPlugin);
	});
});
