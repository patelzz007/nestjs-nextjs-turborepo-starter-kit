import { createHash } from "node:crypto";

import { RewardBackupCodeSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { RewardCodeHasher } from "../../../../../platform/infrastructure/crypto/reward-code-hasher";
import { ClaimCodesAdapter } from "../claim-codes.adapter";

const hasher = new RewardCodeHasher({ 1: Buffer.alloc(32, 7).toString("base64"), 2: Buffer.alloc(32, 9).toString("base64") });
const adapter = new ClaimCodesAdapter(hasher);

describe("ClaimCodesAdapter", () => {
	it("issues a random QR token and a valid backup code, storing only their keyed hashes", () => {
		const first = adapter.issueClaimCodes();
		const second = adapter.issueClaimCodes();

		expect(first.qrPayload).not.toBe(second.qrPayload);
		expect(RewardBackupCodeSchema.safeParse(first.backupCode).success).toBe(true);
		expect(first.hashes).toEqual({ redemptionTokenHash: hasher.hash(first.qrPayload), backupCodeHash: hasher.hash(first.backupCode) });
		expect(first.hashes.redemptionTokenHash).not.toContain(first.qrPayload);
	});

	it("finds a code under every key version (rotation-safe lookups)", () => {
		const { qrPayload, hashes } = adapter.issueClaimCodes();

		expect(adapter.lookupCandidates(qrPayload)).toContain(hashes.redemptionTokenHash);
		expect(adapter.lookupCandidates(qrPayload).length).toBe(2);
	});

	it("issues 6-digit OTPs stored as SHA-256 and hashes a candidate the same way", () => {
		const otp = adapter.issueOtp();

		expect(otp.code).toMatch(/^\d{6}$/);
		expect(otp.codeHash).toBe(createHash("sha256").update(otp.code).digest("hex"));
		expect(adapter.hashOtp(otp.code)).toBe(otp.codeHash);
	});
});
