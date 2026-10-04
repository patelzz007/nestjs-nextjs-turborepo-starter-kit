import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildDeadLetterSeedRows, DEAD_LETTER_SEED_CONSUMER } from "./inbox-dead-letters";

const NOW_MS = 1_790_812_800_000;

describe("buildDeadLetterSeedRows", () => {
	it("is deterministic (stable ids and content across runs)", () => {
		expect(buildDeadLetterSeedRows(NOW_MS)).toEqual(buildDeadLetterSeedRows(NOW_MS));
	});

	it("describes every stored value exactly as the consumer would: size, SHA-256, not truncated", () => {
		for (const row of buildDeadLetterSeedRows(NOW_MS)) {
			const bytes = Buffer.from(row.rawValue);
			expect(row.rawValueSizeBytes).toBe(bytes.length);
			expect(row.rawValueSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
			expect(row.rawValueTruncated).toBe(false);
			expect(row.consumer).toBe(DEAD_LETTER_SEED_CONSUMER);
		}
	});

	it("covers an undecodable record and one parked after the retry budget", () => {
		expect(buildDeadLetterSeedRows(NOW_MS).map((row) => [row.reason, row.attempts])).toEqual([
			["MALFORMED_JSON", 1],
			["RETRIES_EXHAUSTED", 5],
		]);
	});
});
