import type { Prisma } from "@prisma/client";
import { SIGNUP_REFERRAL_CODE_TTL_MS } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { SuperAdminBootstrapRepository } from "./superadmin-bootstrap.repository";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = 1_800_000_000_000;
const USER_ID = "user-root";

type CreateMany = (args: Prisma.SignupReferralCodeCreateManyArgs) => Promise<Prisma.BatchPayload>;

describe("SuperAdminBootstrapRepository.createSuperAdmin", () => {
	const createUser = vi.fn();
	const createCodes: Mock<CreateMany> = vi.fn<CreateMany>();
	const tx: PrismaService = Object.assign(new PrismaService(createTestTypedConfig()), { user: { create: createUser }, signupReferralCode: { createMany: createCodes } });

	beforeEach(() => {
		vi.clearAllMocks();
		createUser.mockResolvedValue({ id: USER_ID, email: "root@acme.test", fullName: "Root Admin" });
		createCodes.mockResolvedValue({ count: 1 });
	});

	it("issues the account's first signup referral code on the bootstrap transaction", async () => {
		const created = await new SuperAdminBootstrapRepository().createSuperAdmin(
			{ email: "root@acme.test", fullName: "Root Admin", passwordHash: "hash", emailVerifiedAt: NOW, mfaEnrollmentDeadline: NOW, referralCodeIssuedAt: NOW },
			tx,
		);

		expect(created.id).toBe(USER_ID);
		expect(createCodes).toHaveBeenCalledWith({
			data: [expect.objectContaining({ userId: USER_ID, createdAt: BigInt(NOW), expiresAt: BigInt(NOW + SIGNUP_REFERRAL_CODE_TTL_MS) })],
			skipDuplicates: true,
		});
	});
});
