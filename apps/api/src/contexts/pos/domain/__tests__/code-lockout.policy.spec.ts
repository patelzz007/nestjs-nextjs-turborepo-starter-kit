import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { PosCodeLockedError } from "../errors/pos.errors";
import { assertCodeRedemptionUnlocked, lockoutAfter, POS_CODE_LOCKOUT_MS, POS_CODE_MAX_FAILURES } from "../policies/code-lockout.policy";
import { NOW } from "./pos-domain.fixture";

describe("assertCodeRedemptionUnlocked", () => {
	it("lets a never-locked key and a key whose lock has run out redeem", () => {
		expect(() => {
			assertCodeRedemptionUnlocked(null, NOW);
		}).not.toThrow();
		expect(() => {
			assertCodeRedemptionUnlocked(NOW, NOW);
		}).not.toThrow();
		expect(() => {
			assertCodeRedemptionUnlocked(epochMs(NOW - 1), NOW);
		}).not.toThrow();
	});

	it("refuses a locked key, naming when it unlocks", () => {
		const lockedUntil = epochMs(NOW + 1);
		expect(() => {
			assertCodeRedemptionUnlocked(lockedUntil, NOW);
		}).toThrow(PosCodeLockedError);
		expect(() => {
			assertCodeRedemptionUnlocked(lockedUntil, NOW);
		}).toThrow(expect.objectContaining({ lockedUntil, details: { lockedUntil } }));
	});
});

describe("lockoutAfter", () => {
	it("locks only once the window reaches the limit, for the lockout period", () => {
		expect(lockoutAfter(POS_CODE_MAX_FAILURES - 1, NOW)).toBeNull();
		expect(lockoutAfter(POS_CODE_MAX_FAILURES, NOW)).toBe(NOW + POS_CODE_LOCKOUT_MS);
		expect(lockoutAfter(POS_CODE_MAX_FAILURES + 5, NOW)).toBe(NOW + POS_CODE_LOCKOUT_MS);
	});
});
