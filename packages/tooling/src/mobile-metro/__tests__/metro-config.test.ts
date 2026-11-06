/**
 * The mobile app's Metro settings its cold start depends on (rules/19, T44). The config is a
 * CommonJS file Metro loads in plain Node; the mobile test runner (jest-expo) cannot load
 * `expo/metro-config`, and the mobile app has no Node typings, so it is checked here, in Node.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

/** apps/mobile, from packages/tooling/src/mobile-metro/__tests__. */
const MOBILE_APP_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..", "apps", "mobile");

/** Loads the real config as Metro does and prints its transform options. */
const PRINT_TRANSFORM_OPTIONS = "require('./metro.config.js').transformer.getTransformOptions().then((options) => process.stdout.write(JSON.stringify(options)))";

const TransformOptionsSchema = z.object({ transform: z.object({ experimentalImportSupport: z.boolean(), inlineRequires: z.boolean() }) });

describe("apps/mobile metro.config.js", () => {
	it("evaluates modules on first use (inlineRequires) without the experimental import transform", () => {
		const output = execFileSync(process.execPath, ["-e", PRINT_TRANSFORM_OPTIONS], { cwd: MOBILE_APP_ROOT, encoding: "utf8" });

		expect(TransformOptionsSchema.parse(JSON.parse(output)).transform).toEqual({ experimentalImportSupport: false, inlineRequires: true });
	});
});
