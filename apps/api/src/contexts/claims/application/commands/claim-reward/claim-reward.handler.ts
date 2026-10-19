import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { CreateRewardClaimInput, EpochMs, RewardClaimCreatedResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { RewardClaim } from "../../../domain/aggregates/reward-claim.aggregate";
import { ClaimantNotFoundError, LegalAcceptanceRequiredError, OtpInvalidError, OtpMissingError, OtpRequiredError } from "../../../domain/errors/claims.errors";
import { assertWithinClaimLimit } from "../../../domain/policies/claim-limit.policy";
import { claimNeedsOtp, liveAttributionToken } from "../../../domain/policies/phone-verification.policy";
import type { ClaimsScope } from "../../claims-scope";
import type { ClaimCodesPort } from "../../ports/claim-codes.port";
import type { ClaimantProfile } from "../../ports/claims-transactional.ports";
import { CLAIM_CODES, CLAIM_ID_GENERATOR, CLAIMS_UNIT_OF_WORK, ROUTE_RLS_BYPASS_OPERATION, type ClaimIdGenerator } from "../../ports/claims.tokens";
import { actingUserId } from "../acting-user";
import { ClaimRewardCommand } from "./claim-reward.command";

/** How the claim transaction ended: a claim, or a wrong OTP whose spent attempt must still commit. */
type ClaimOutcome = { readonly kind: "created"; readonly response: RewardClaimCreatedResponse } | { readonly kind: "otp_rejected" };

/**
 * Claims one unit of a reward in ONE transaction: the claimant's row lock (D08), the OTP attempt
 * compare-and-set (D09), the per-customer limit, the stock reservation on the Reward aggregate,
 * the referral attribution, the claim and the verified phone all commit or roll back together.
 * A wrong code is the exception: its attempt is committed (so guessing is counted) and the
 * request then fails with `OTP_INVALID`.
 */
@CommandHandler(ClaimRewardCommand)
export class ClaimRewardHandler implements ICommandHandler<ClaimRewardCommand, RewardClaimCreatedResponse> {
	public constructor(
		@Inject(CLAIMS_UNIT_OF_WORK) private readonly uow: UnitOfWork<ClaimsScope>,
		@Inject(CLAIM_CODES) private readonly codes: ClaimCodesPort,
		@Inject(CLAIM_ID_GENERATOR) private readonly ids: ClaimIdGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ClaimRewardCommand): Promise<RewardClaimCreatedResponse> {
		const { actor, input } = command;
		const userId = actingUserId(actor);

		const outcome = await this.uow.runSystemOperation(ROUTE_RLS_BYPASS_OPERATION, actor, async (scope: ClaimsScope): Promise<ClaimOutcome> => {
			const now = this.clock.now();
			if (!(await scope.legal.hasAccepted(userId))) {
				throw new LegalAcceptanceRequiredError();
			}
			const claimant = await scope.claimants.lockForClaim(userId);
			if (claimant === null) {
				throw new ClaimantNotFoundError();
			}
			if (claimNeedsOtp(claimant, input.phone) && !(await this.verifyOtp(scope, userId, input, now))) {
				return { kind: "otp_rejected" };
			}
			return { kind: "created", response: await this.claim(scope, userId, claimant, input, now) };
		});

		if (outcome.kind === "otp_rejected") {
			throw new OtpInvalidError();
		}
		return outcome.response;
	}

	/** Spends one attempt of the live challenge; answers whether the code matched. */
	private async verifyOtp(scope: ClaimsScope, userId: string, input: CreateRewardClaimInput, now: EpochMs): Promise<boolean> {
		if (input.otp === undefined) {
			throw new OtpRequiredError();
		}
		const challenge = await scope.otpChallenges.findActive(userId, input.phone, input.rewardId, now);
		if (challenge === null) {
			throw new OtpMissingError();
		}
		const valid = challenge.verify(this.codes.hashOtp(input.otp), now);
		await scope.otpChallenges.recordAttempt(challenge);
		return valid;
	}

	private async claim(scope: ClaimsScope, userId: string, claimant: ClaimantProfile, input: CreateRewardClaimInput, now: EpochMs): Promise<RewardClaimCreatedResponse> {
		const reward = await scope.rewards.assertClaimable(input.rewardId, now);
		assertWithinClaimLimit(await scope.claims.countHeld(userId, input.rewardId), reward.maxClaimsPerUser);
		await scope.rewards.reserve(input.rewardId, now);

		const attributionToken = liveAttributionToken(claimant.pendingAttributionToken, claimant.pendingAttributionExpiresAt, now);
		const referralId = attributionToken === null ? null : await scope.referralAttribution.attach(attributionToken, input.rewardId, userId);
		const codes = this.codes.issueClaimCodes();
		const claim = RewardClaim.create({ id: this.ids.next(), userId, rewardId: input.rewardId, referralId, codes: codes.hashes, rewardExpiry: reward.expiryDate }, now);
		await scope.claims.add(claim);
		await scope.claimants.recordVerifiedPhone(userId, input.phone, now);
		scope.events.collectFrom(claim);

		return { claim: await scope.views.getResponse(claim.id), qrDeepLink: `/rewards/claims/${claim.id}/qr`, backupCode: codes.backupCode };
	}
}
