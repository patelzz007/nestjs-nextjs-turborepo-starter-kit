import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { RewardCodeHasher, RewardCodeHashKeyRingEmptyError } from "./reward-code-hasher";

const KEY_1 = Buffer.alloc(32, 1).toString("base64");
const KEY_2 = Buffer.alloc(32, 2).toString("base64");
const CODE = "ABCD2345";

describe("RewardCodeHasher", () => {
	it("hashes with the highest key version and is keyed (not a plain SHA-256)", () => {
		const hasher = new RewardCodeHasher({ 1: KEY_1, 2: KEY_2 });
		const hash = hasher.hash(CODE);

		expect(hash).toMatch(/^v2:[0-9a-f]{64}$/u);
		expect(hash).not.toContain(createHash("sha256").update(CODE).digest("hex"));
		expect(new RewardCodeHasher({ 2: Buffer.alloc(32, 9).toString("base64") }).hash(CODE)).not.toBe(hash);
	});

	it("still finds codes hashed before a rotation", () => {
		const before = new RewardCodeHasher({ 1: KEY_1 }).hash(CODE);
		const afterRotation = new RewardCodeHasher({ 1: KEY_1, 2: KEY_2 });

		expect(afterRotation.lookupCandidates(CODE)).toContain(before);
		expect(afterRotation.lookupCandidates(CODE)[LIST_SLOT_INDEX.first]).toBe(afterRotation.hash(CODE));
	});

	it("refuses an empty key ring", () => {
		expect(() => new RewardCodeHasher({})).toThrow(RewardCodeHashKeyRingEmptyError);
	});
});
