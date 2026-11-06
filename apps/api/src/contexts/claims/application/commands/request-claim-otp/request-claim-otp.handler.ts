import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, type EpochMs, type RequestClaimOtpResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { RewardClaimOtpEmailTemplate } from "../../../../notifications/public-api";
import type { ClaimableRewardFacts } from "../../../../rewards/public-api";
import { ClaimHold } from "../../../domain/aggregates/claim-hold.aggregate";
import { OtpChallenge } from "../../../domain/aggregates/otp-challenge.aggregate";
import { ClaimantNotFoundError } from "../../../domain/errors/claims.errors";
import { assertWithinClaimLimit } from "../../../domain/policies/claim-limit.policy";
import { assertMayTakeHold } from "../../../domain/policies/claim-hold.policy";
import { CLAIM_HOLD_WINDOW_MS, OTP_EXPIRES_MINUTES } from "../../../domain/value-objects/claim-rules.value-object";
import type { ClaimsScope } from "../../claims-scope";
import type { ClaimCodesPort } from "../../ports/claim-codes.port";
import { CLAIM_CODES, CLAIM_ID_GENERATOR, CLAIMS_UNIT_OF_WORK, CLAIM_OTP_REQUEST_OPERATION, type ClaimIdGenerator } from "../../ports/claims.tokens";
import { actingUserId } from "../acting-user";
import { assertCustomerMayClaim } from "../customer-may-claim";
import { RequestClaimOtpCommand } from "./request-claim-otp.command";

/**
 * Emails the customer a one-time code for claiming a reward and holds one unit for them while they
 * enter it. The hold, the challenge row and the durable email request (ADR 060) commit together. The
 * customer's row lock serialises their own requests, so a double click cannot take two units; asking
 * for another code keeps the same hold and never extends it.
 */
@CommandHandler(RequestClaimOtpCommand)
export class RequestClaimOtpHandler implements ICommandHandler<RequestClaimOtpCommand, RequestClaimOtpResponse> {
	public constructor(
		@Inject(CLAIMS_UNIT_OF_WORK) private readonly uow: UnitOfWork<ClaimsScope>,
		@Inject(CLAIM_CODES) private readonly codes: ClaimCodesPort,
		@Inject(CLAIM_ID_GENERATOR) private readonly ids: ClaimIdGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestClaimOtpCommand): Promise<RequestClaimOtpResponse> {
		const { actor, input } = command;
		const userId = actingUserId(actor);

		return this.uow.runSystemOperation(CLAIM_OTP_REQUEST_OPERATION, actor, async (scope: ClaimsScope): Promise<RequestClaimOtpResponse> => {
			const now = this.clock.now();
			const claimant = await scope.claimants.lockForClaim(userId);
			if (claimant === null) {
				throw new ClaimantNotFoundError();
			}
			const live = await scope.holds.findLive(userId, input.rewardId, now);
			const reward = await scope.rewards.assertClaimable(input.rewardId, now, userId, live !== null);
			const otp = this.codes.issueOtp();
			const challenge = OtpChallenge.issue(this.ids.next(), userId, input.phone, input.rewardId, otp.codeHash, now);
			await scope.otpChallenges.add(challenge);
			const hold = live ?? (await this.takeHold(scope, userId, input.rewardId, reward, now));
			await scope.emails.request(new RewardClaimOtpEmailTemplate({ to: claimant.email, rewardTitle: reward.title, otpCode: otp.code, expiresInMinutes: OTP_EXPIRES_MINUTES }));
			scope.events.collectFrom(challenge);
			return { ok: true, holdExpiresAt: hold.expiresAt };
		});
	}

	private async takeHold(scope: ClaimsScope, userId: string, rewardId: string, reward: ClaimableRewardFacts, now: EpochMs): Promise<ClaimHold> {
		await assertCustomerMayClaim(scope, reward.tenantId, userId, rewardId);
		assertWithinClaimLimit(await scope.claims.countHeld(userId, rewardId), reward.maxClaimsPerUser);
		assertMayTakeHold(await scope.holds.countLive(userId, now), await scope.holds.countTakenSince(userId, rewardId, epochMs(now - CLAIM_HOLD_WINDOW_MS)));
		await scope.rewards.holdUnit(rewardId, now, userId);
		const hold = ClaimHold.place(this.ids.next(), userId, rewardId, now);
		await scope.holds.add(hold);
		return hold;
	}
}
