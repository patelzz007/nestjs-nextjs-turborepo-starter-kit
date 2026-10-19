import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { SIGNUP_REFERRAL_AUDIT_FACTORY, type SignupReferralAuditFactory } from "../../../../referrals/public-api";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { RewardsAccessModule } from "../../rewards-access.module";
import { REWARD_AUDIT_SIGNUP_REFERRAL_AUDIT_FACTORY, SIGNUP_REFERRAL_CODE_ISSUED_AUDIT_ACTION } from "../signup-referral-audit.adapter";

vi.mock("../../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

describe("REWARD_AUDIT_SIGNUP_REFERRAL_AUDIT_FACTORY", () => {
	it("records each issued code in the rewards audit trail on the code job's transaction, without the code value", async () => {
		const createMany = vi.fn<(args: Prisma.RewardAuditLogCreateManyArgs) => Promise<Prisma.BatchPayload>>().mockResolvedValue({ count: 1 });
		const tx = Object.assign(new PrismaService(createTestTypedConfig()), { rewardAuditLog: { createMany } });

		await REWARD_AUDIT_SIGNUP_REFERRAL_AUDIT_FACTORY.forTransaction(tx).recordCodeIssued({ ownerUserId: "user-1", referralCodeId: "code-1", successor: true });

		expect(createMany).toHaveBeenCalledWith({
			data: [
				{
					organizationId: null,
					actorUserId: null,
					action: SIGNUP_REFERRAL_CODE_ISSUED_AUDIT_ACTION,
					metadata: { actor: "system", ownerUserId: "user-1", referralCodeId: "code-1", successor: true },
				},
			],
		});
	});
});

/** A module that only consumes the token, as referrals does (it imports nothing of rewards). */
class TokenConsumerModule {}
Module({
	providers: [{ provide: "CONSUMER", inject: [SIGNUP_REFERRAL_AUDIT_FACTORY], useFactory: (factory: SignupReferralAuditFactory): SignupReferralAuditFactory => factory }],
})(TokenConsumerModule);

describe("RewardsAccessModule", () => {
	it("provides referrals' audit factory globally, so a module that never imports rewards can inject it", async () => {
		const moduleRef = await Test.createTestingModule({ imports: [RewardsAccessModule, TokenConsumerModule] }).compile();

		expect(moduleRef.get<SignupReferralAuditFactory>("CONSUMER")).toBe(REWARD_AUDIT_SIGNUP_REFERRAL_AUDIT_FACTORY);
	});
});
