import { epochMs, type FeatureFlagBundle } from "@workspace/shared";

import { parseCachedBundle, readCachedBundle, writeCachedBundle, type BundleStorage } from "../cached-bundle";

const NOW = 1_800_000_000_000;
const OVERSIZED_RULE_COUNT = 200;
const RULE = "019b76da-a800-7000-8000-0000000000a1";

const BUNDLE: FeatureFlagBundle = {
	version: 4,
	app: "mobile",
	evaluatedAt: epochMs(NOW),
	nextChangeAt: null,
	flags: [{ key: "mobile-analytics", on: false, source: "RULE", revision: 2, ruleId: RULE }],
	configs: [],
};

function memory(initial: string | null = null, failing = false): BundleStorage & { readonly value: () => string | null } {
	let stored = initial;
	return {
		value: (): string | null => stored,
		read: (): Promise<string | null> => (failing ? Promise.reject(new Error("keychain locked")) : Promise.resolve(stored)),
		write: (json: string): Promise<void> => {
			if (failing) {
				return Promise.reject(new Error("keychain locked"));
			}
			stored = json;
			return Promise.resolve();
		},
	};
}

describe("cached bundle", () => {
	it("keeps the last bundle and reads it back", async () => {
		const store = memory();
		await writeCachedBundle(store, BUNDLE);
		await expect(readCachedBundle(store)).resolves.toStrictEqual(BUNDLE);
	});

	it("reads nothing kept, or something that isn't a bundle, as none", () => {
		expect(parseCachedBundle(null)).toBeNull();
		expect(parseCachedBundle("{ not json")).toBeNull();
		expect(parseCachedBundle(JSON.stringify({ version: "x" }))).toBeNull();
	});

	it("doesn't keep a bundle too large for its entry", async () => {
		const store = memory();
		const flags = Array.from({ length: OVERSIZED_RULE_COUNT }, (): FeatureFlagBundle["flags"][number] => ({
			key: "mobile-analytics",
			on: true,
			source: "RULE",
			revision: 1,
			ruleId: RULE,
		}));
		await writeCachedBundle(store, { ...BUNDLE, flags });
		expect(store.value()).toBeNull();
	});

	it("never throws when Secure Store can't be used", async () => {
		const store = memory(null, true);
		await expect(readCachedBundle(store)).resolves.toBeNull();
		await expect(writeCachedBundle(store, BUNDLE)).resolves.toBeUndefined();
	});
});
