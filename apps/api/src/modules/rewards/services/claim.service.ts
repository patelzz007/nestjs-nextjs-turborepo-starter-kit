import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type {
	CreateRewardClaimInput,
	PaginatedServiceResult,
	RedemptionCode,
	RewardClaimCreatedResponse,
	RewardClaimListQuery,
	RewardClaimQrResponse,
	RewardClaimResponse,
} from "@workspace/shared";
import { DAY_MS, EpochMsSchema } from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { RewardClaimRepository, type RewardClaimRedemptionLookup } from "../repositories/reward-claim.repository";
import { RewardRepository, type RewardClaimableSummary } from "../repositories/reward.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import { RewardCodeHasher } from "../crypto/reward-code-hasher";
import { rewardRulesFromStorage } from "../utils/reward-rules.util";
import { generateBackupCode, generateOpaqueToken } from "../utils/reward-crypto.util";
import { mapClaimToResponse } from "../utils/reward-mapper.util";
import { RewardLegalService } from "./reward-legal.service";
import { RewardOtpService } from "./reward-otp.service";

/** A consumer claim stays redeemable this long (capped by the reward's own expiry). */
const CLAIM_TTL_DAYS = 7;
const CLAIM_TTL_MS = CLAIM_TTL_DAYS * DAY_MS;

@Injectable()
export class ClaimService {
	public constructor(
		private readonly rewardRepository: RewardRepository,
		private readonly rewardClaimRepository: RewardClaimRepository,
		private readonly rewardUserRepository: RewardUserRepository,
		private readonly legalService: RewardLegalService,
		private readonly otpService: RewardOtpService,
		private readonly codeHasher: RewardCodeHasher,
	) {}

	public async requestOtp(userId: string, rewardId: string, phone: string): Promise<{ ok: true }> {
		await this.ensureRewardClaimable(rewardId);
		await this.otpService.sendClaimOtp(userId, phone, rewardId);
		return { ok: true };
	}

	public async createClaim(userId: string, input: CreateRewardClaimInput): Promise<RewardClaimCreatedResponse> {
		if (!(await this.legalService.hasAccepted(userId))) {
			throw new ForbiddenException({ message: "Accept terms before claiming", error: "LEGAL_ACCEPTANCE_REQUIRED" });
		}

		await this.verifyClaimOtpIfNeeded(userId, input.phone, input.otp, input.rewardId);

		const reward = await this.ensureRewardClaimable(input.rewardId);
		const now = Date.now();
		const claimExpiresAt = Math.min(now + CLAIM_TTL_MS, Number(reward.expiryDate));
		const maxClaimsPerUser = rewardRulesFromStorage(reward.rules, reward.minSpendMinor)?.maxUsePerUser ?? null;

		const token = generateOpaqueToken();
		const backupCode = generateBackupCode();
		const user = await this.rewardUserRepository.findAttributionById(userId);
		const attributionLive =
			user !== null && user.pendingAttributionToken !== null && (user.pendingAttributionExpiresAt === null || Number(user.pendingAttributionExpiresAt) >= now);

		const outcome = await this.rewardClaimRepository.createReservedClaim({
			userId,
			rewardId: reward.id,
			maxClaimsPerUser,
			redemptionTokenHash: this.codeHasher.hash(token),
			backupCodeHash: this.codeHasher.hash(backupCode),
			claimedAt: now,
			claimExpiresAt,
			attributionToken: attributionLive ? user.pendingAttributionToken : null,
			phone: input.phone,
		});
		if (outcome.kind === "out_of_stock") {
			throw new ConflictException({ message: "This reward just sold out", error: "REWARD_OUT_OF_STOCK" });
		}
		if (outcome.kind === "limit_reached") {
			throw new ConflictException({ message: `You can hold at most ${String(outcome.limit)} claim(s) of this reward`, error: "CLAIM_LIMIT_REACHED", limit: outcome.limit });
		}
		const { claim } = outcome;

		const claimResponse = mapClaimToResponse(claim, reward.title);

		return {
			claim: claimResponse,
			qrDeepLink: `/rewards/claims/${claim.id}/qr`,
			backupCode,
		};
	}

	public async listClaims(userId: string, query: RewardClaimListQuery): Promise<PaginatedServiceResult<RewardClaimResponse>> {
		const result = await this.rewardClaimRepository.listForUser(userId, query);
		return toPaginatedServiceResult(
			mapListResult(result, (row) => mapClaimToResponse(row, row.reward.title)),
			query,
		);
	}

	public async getClaimQr(userId: string, claimId: string): Promise<RewardClaimQrResponse> {
		const claim = await this.rewardClaimRepository.findActiveForUser(claimId, userId);

		if (claim === null) {
			throw new NotFoundException({ message: "Claim not found", error: "CLAIM_NOT_FOUND" });
		}

		if (claim.status !== "PENDING") {
			throw new BadRequestException({ message: "Claim is not active", error: "CLAIM_NOT_ACTIVE" });
		}

		if (Number(claim.claimExpiresAt) < Date.now()) {
			throw new BadRequestException({ message: "Claim expired", error: "CLAIM_EXPIRED" });
		}

		const token = generateOpaqueToken();
		const backupCode = generateBackupCode();
		await this.rewardClaimRepository.updateTokenHashes(claim.id, userId, this.codeHasher.hash(token), this.codeHasher.hash(backupCode));

		return {
			claimId: claim.id,
			qrPayload: token,
			backupCode,
			claimExpiresAt: EpochMsSchema.parse(Number(claim.claimExpiresAt)),
		};
	}

	/**
	 * The claim behind one scanned code, if it belongs to `organizationId`.
	 * `null` for an unknown code AND for another merchant's code — the caller
	 * answers both the same way (no cross-merchant oracle). The schema
	 * guarantees exactly one of `token` / `backupCode`.
	 */
	public async findMerchantClaim(code: RedemptionCode, organizationId: string): Promise<RewardClaimRedemptionLookup | null> {
		const claim =
			code.token !== undefined
				? await this.rewardClaimRepository.findMerchantClaimByTokenHash(this.codeHasher.lookupCandidates(code.token), organizationId)
				: code.backupCode !== undefined
					? await this.rewardClaimRepository.findMerchantClaimByBackupCodeHash(this.codeHasher.lookupCandidates(code.backupCode), organizationId)
					: null;
		return claim === null ? null : this.rewardClaimRepository.toRedemptionLookup(claim);
	}

	private async verifyClaimOtpIfNeeded(userId: string, phone: string, otp: string | undefined, rewardId: string): Promise<void> {
		const profile = await this.rewardUserRepository.findClaimCheckoutById(userId);

		if (profile !== null && profile.phoneVerifiedAt !== null && profile.phone === phone) {
			return;
		}

		if (otp === undefined) {
			throw new BadRequestException({ message: "OTP required for this phone number", error: "OTP_REQUIRED" });
		}

		await this.otpService.verifyClaimOtp(userId, phone, otp, rewardId);
	}

	private async ensureRewardClaimable(rewardId: string): Promise<RewardClaimableSummary> {
		const reward = await this.rewardRepository.findClaimableConsumer(rewardId);

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		if (Number(reward.expiryDate) < Date.now()) {
			throw new BadRequestException({ message: "Reward expired", error: "REWARD_EXPIRED" });
		}

		if (reward.quantityRemaining <= 0) {
			throw new ConflictException({ message: "This reward is sold out", error: "REWARD_OUT_OF_STOCK" });
		}

		return reward;
	}
}
