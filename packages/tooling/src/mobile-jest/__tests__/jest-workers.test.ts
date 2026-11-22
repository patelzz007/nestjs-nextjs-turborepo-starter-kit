/**
 * The worker pool of the two jest-expo suites (apps/mobile, packages/ui-native). jest-expo's preset caps Jest to ONE
 * worker whenever `TURBO_HASH` is set, assuming Turborepo runs several workspaces' tests at once. This repo runs them
 * one at a time (`turbo run test --concurrency=1`), so under `pnpm test` and the pre-push hook that cap ran each suite
 * in a single process (mobile: 250 s instead of 92 s). Each config therefore sets Jest's own default, every core but
 * one, and Jest lets a config's `maxWorkers` win over its preset's. The configs are CommonJS that Jest loads in plain
 * Node, so they are checked here, in Node.
 */
import { createRequire } from "node:module";
import { availableParallelism } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const SUITES: readonly string[] = ["apps/mobile", "packages/ui-native"];

const JestConfigSchema = z.object({ preset: z.literal("jest-expo"), maxWorkers: z.number().int().positive() });
const PresetWorkersSchema = z.object({ maxWorkers: z.number().int().positive().optional() });

/** Loads a CommonJS module afresh (not from Node's module cache), resolved from `suite`, as Jest would on a new run. */
function loadFresh(suite: string, request: string): object {
	const require = createRequire(path.join(REPO_ROOT, suite, "package.json"));
	const resolved = require.resolve(request);
	Reflect.deleteProperty(require.cache, resolved);
	return z.looseObject({}).parse(require(resolved));
}

beforeEach((): void => {
	// What Turborepo sets for every task it runs.
	vi.stubEnv("TURBO_HASH", "0123456789abcdef");
});

afterEach((): void => {
	vi.unstubAllEnvs();
});

describe("jest-expo worker pool under Turborepo", () => {
	it.each(SUITES)("%s: jest-expo's preset still caps a Turborepo task to one worker (the reason for the override)", (suite) => {
		const presetWorkers = PresetWorkersSchema.parse(loadFresh(suite, "jest-expo/config/maxWorkers"));

		expect(presetWorkers.maxWorkers).toBe(1);
	});

	it.each(SUITES)("%s: its config keeps every core but one, so Turborepo's one-at-a-time run is not single-process", (suite) => {
		const config = JestConfigSchema.parse(loadFresh(suite, "./jest.config.js"));

		expect(config.maxWorkers).toBe(Math.max(availableParallelism() - 1, 1));
	});
});
