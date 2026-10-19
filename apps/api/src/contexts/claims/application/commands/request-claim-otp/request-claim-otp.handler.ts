import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OkResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { RewardClaimOtpEmailTemplate } from "../../../../notifications/public-api";
import { OtpChallenge } from "../../../domain/aggregates/otp-challenge.aggregate";
import { ClaimantNotFoundError } from "../../../domain/errors/claims.errors";
import { OTP_EXPIRES_MINUTES } from "../../../domain/value-objects/claim-rules.value-object";
import type { ClaimsScope } from "../../claims-scope";
import type { ClaimCodesPort } from "../../ports/claim-codes.port";
import { CLAIM_CODES, CLAIM_ID_GENERATOR, CLAIMS_UNIT_OF_WORK, ROUTE_RLS_BYPASS_OPERATION, type ClaimIdGenerator } from "../../ports/claims.tokens";
import { actingUserId } from "../acting-user";
import { RequestClaimOtpCommand } from "./request-claim-otp.command";

/**
 * Emails the customer a one-time code for claiming a reward. The challenge row and the durable
 * email request (ADR 060) commit together: no code is ever stored without its email, nor sent
 * without being stored.
 */
@CommandHandler(RequestClaimOtpCommand)
export class RequestClaimOtpHandler implements ICommandHandler<RequestClaimOtpCommand, OkResponse> {
	public constructor(
		@Inject(CLAIMS_UNIT_OF_WORK) private readonly uow: UnitOfWork<ClaimsScope>,
		@Inject(CLAIM_CODES) private readonly codes: ClaimCodesPort,
		@Inject(CLAIM_ID_GENERATOR) private readonly ids: ClaimIdGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestClaimOtpCommand): Promise<OkResponse> {
		const { actor, input } = command;
		const userId = actingUserId(actor);

		return this.uow.runSystemOperation(ROUTE_RLS_BYPASS_OPERATION, actor, async (scope: ClaimsScope): Promise<OkResponse> => {
			const now = this.clock.now();
			const reward = await scope.rewards.assertClaimable(input.rewardId, now);
			const claimant = await scope.claimants.profile(userId);
			if (claimant === null) {
				throw new ClaimantNotFoundError();
			}
			const otp = this.codes.issueOtp();
			const challenge = OtpChallenge.issue(this.ids.next(), userId, input.phone, input.rewardId, otp.codeHash, now);
			await scope.otpChallenges.add(challenge);
			await scope.emails.request(new RewardClaimOtpEmailTemplate({ to: claimant.email, rewardTitle: reward.title, otpCode: otp.code, expiresInMinutes: OTP_EXPIRES_MINUTES }));
			scope.events.collectFrom(challenge);
			return { ok: true };
		});
	}
}
