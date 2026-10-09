import type { Prisma } from "@prisma/client";
import { SIGNUP_REFERRAL_CODE_TTL_MS } from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { issueSignupReferralCode, SIGNUP_REFERRAL_CODE_MAX_ATTEMPTS } from "./signup-referral-code.issuer";
import { SignupReferralCodeAllocationError } from "./signup-referral.errors";

const USER_ID = "user-1";
const NOW = 1_800_000_000_000;
/** A row id the issuer generates itself, so the audit row can name it without reading the code back. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

type CreateMany = (args: Prisma.SignupReferralCodeCreateManyArgs) => Promise<Prisma.BatchPayload>;

function txWithCreateMany(createMany: Mock<CreateMany>): PrismaService {
	return Object.assign(new PrismaService(createTestTypedConfig()), { signupReferralCode: { createMany } });
}

describe("issueSignupReferralCode", () => {
	it("writes the code with createdAt = now and expiresAt = now + TTL, never aborting the transaction on a collision", async () => {
		const createMany = vi.fn<CreateMany>().mockResolvedValue({ count: 1 });

		const issued = await issueSignupReferralCode(txWithCreateMany(createMany), USER_ID, NOW, () => "AB23CD45");

		expect(issued.id).toMatch(UUID_PATTERN);
		expect(issued).toEqual({ id: issued.id, code: "AB23CD45", createdAt: NOW, expiresAt: NOW + SIGNUP_REFERRAL_CODE_TTL_MS });
		expect(createMany).toHaveBeenCalledWith({
			data: [{ id: issued.id, userId: USER_ID, code: "AB23CD45", createdAt: BigInt(NOW), updatedAt: BigInt(NOW), expiresAt: BigInt(NOW + SIGNUP_REFERRAL_CODE_TTL_MS) }],
			skipDuplicates: true,
		});
	});

	it("tries a new value when the candidate already exists", async () => {
		const createMany = vi.fn<CreateMany>().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
		const generate = vi.fn<() => string>().mockReturnValueOnce("AB23CD45").mockReturnValueOnce("K7M2PQ8R");

		const issued = await issueSignupReferralCode(txWithCreateMany(createMany), USER_ID, NOW, generate);

		expect(issued.code).toBe("K7M2PQ8R");
		expect(createMany).toHaveBeenCalledTimes(2);
	});

	it("gives up with a typed error after the attempt bound", async () => {
		const createMany = vi.fn<CreateMany>().mockResolvedValue({ count: 0 });

		await expect(issueSignupReferralCode(txWithCreateMany(createMany), USER_ID, NOW, () => "AB23CD45")).rejects.toBeInstanceOf(SignupReferralCodeAllocationError);
		expect(createMany).toHaveBeenCalledTimes(SIGNUP_REFERRAL_CODE_MAX_ATTEMPTS);
	});
});
