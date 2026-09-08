import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type {
	CreateRewardClaimInput,
	PaginatedServiceResult,
	RewardClaimCreatedResponse,
	RewardClaimListQuery,
	RewardClaimQrResponse,
	RewardClaimResponse,
	RewardType,
} from "@workspace/shared";
import { EpochMsSchema, RewardBackupCodeSchema } from "@workspace/shared";

import { paginateCursorListResult } from "../../../platform/persistence/cursor-list";
import { RewardClaimRepository } from "../repositories/reward-claim.repository";
import { RewardReferralRepository } from "../repositories/reward-referral.repository";
import { RewardRepository } from "../repositories/reward.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import { generateBackupCode, generateOpaqueToken, sha256Hex } from "../utils/reward-crypto.util";
import { mapClaimToResponse } from "../utils/reward-mapper.util";
import { RewardLegalService } from "./reward-legal.service";
import { RewardOtpService } from "./reward-otp.service";

const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BACKUP_LOCK_MS = 15 * 60 * 1000;
const MAX_BACKUP_FAILURES = 5;

@Injectable()
export class ClaimService {
	public constructor(
		private readonly rewardRepository: RewardRepository,
		private readonly rewardClaimRepository: RewardClaimRepository,
		private readonly rewardReferralRepository: RewardReferralRepository,
		private readonly rewardUserRepository: RewardUserRepository,
		private readonly legalService: RewardLegalService,
		private readonly otpService: RewardOtpService,
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

		const reserved = await this.rewardRepository.reserveQuantity(reward.id);

		if (reserved === 0) {
			throw new ConflictException({ message: "This reward just sold out", error: "REWARD_OUT_OF_STOCK" });
		}

		const token = generateOpaqueToken();
		const backupCode = generateBackupCode();

		let referralId: string | null = null;
		const user = await this.rewardUserRepository.findAttributionById(userId);

		if (user?.pendingAttributionToken !== null && user?.pendingAttributionToken !== undefined) {
			const notExpired = user.pendingAttributionExpiresAt === null || Number(user.pendingAttributionExpiresAt) >= now;
			if (notExpired) {
				const referral = await this.rewardReferralRepository.findPendingByTokenAndReward(user.pendingAttributionToken, reward.id);
				if (referral !== null) {
					referralId = referral.id;
					await this.rewardReferralRepository.assignReferee(referral.id, userId);
				}
			}
		}

		const claim = await this.rewardClaimRepository.create({
			userId,
			rewardId: reward.id,
			referralId,
			redemptionTokenHash: sha256Hex(token),
			backupCodeHash: sha256Hex(backupCode),
			status: "PENDING",
			claimedAt: now,
			claimExpiresAt,
		});

		await this.rewardUserRepository.updateAfterClaim(userId, {
			phone: input.phone,
			phoneVerifiedAt: now,
			pendingAttributionToken: null,
			pendingAttributionExpiresAt: null,
		});

		const claimResponse = mapClaimToResponse(claim, reward.title);

		return {
			claim: claimResponse,
			qrDeepLink: `/rewards/claims/${claim.id}/qr`,
			backupCode,
		};
	}

	public async listClaims(userId: string, query: RewardClaimListQuery): Promise<PaginatedServiceResult<RewardClaimResponse>> {
		const result = await this.rewardClaimRepository.listForUser(userId, query);
		return paginateCursorListResult({ ...result, items: result.items.map((row) => mapClaimToResponse(row, row.reward.title)) }, query);
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
		await this.rewardClaimRepository.updateTokenHashes(claim.id, userId, sha256Hex(token), sha256Hex(backupCode));

		return {
			claimId: claim.id,
			qrPayload: token,
			backupCode,
			claimExpiresAt: EpochMsSchema.parse(Number(claim.claimExpiresAt)),
			backupLockedUntil: claim.backupLockedUntil === null ? null : EpochMsSchema.parse(Number(claim.backupLockedUntil)),
		};
	}

	public async findClaimByTokenOrBackup(
		token: string | undefined,
		backupCode: string | undefined,
	): Promise<{
		claim: {
			id: string;
			userId: string;
			rewardId: string;
			status: "PENDING" | "REDEEMED" | "EXPIRED";
			claimExpiresAt: bigint;
			redemptionTokenHash: string;
			backupFailedAttempts: number;
			backupLockedUntil: bigint | null;
		};
		reward: { id: string; merchantOrgId: string; title: string; rewardType: RewardType; expiryDate: bigint };
	}> {
		if (token !== undefined) {
			const claim = await this.rewardClaimRepository.findByRedemptionTokenHash(sha256Hex(token));
			if (claim === null) {
				throw new NotFoundException({ message: "Invalid token", error: "REDEMPTION_TOKEN_INVALID" });
			}
			return this.rewardClaimRepository.toRedemptionLookup(claim);
		}

		if (backupCode !== undefined) {
			RewardBackupCodeSchema.parse(backupCode);
			const claim = await this.rewardClaimRepository.findByBackupCodeHash(sha256Hex(backupCode));
			if (claim === null) {
				throw new NotFoundException({ message: "Invalid backup code", error: "REDEMPTION_TOKEN_INVALID" });
			}
			return this.rewardClaimRepository.toRedemptionLookup(claim);
		}

		throw new BadRequestException({ message: "token or backupCode required", error: "REDEMPTION_INPUT_REQUIRED" });
	}

	public async recordBackupFailure(claimId: string): Promise<void> {
		const claim = await this.rewardClaimRepository.findById(claimId);
		if (claim === null) {
			return;
		}

		const attempts = claim.backupFailedAttempts + 1;
		await this.rewardClaimRepository.recordBackupFailure(claimId, attempts, attempts >= MAX_BACKUP_FAILURES ? BigInt(Date.now() + BACKUP_LOCK_MS) : claim.backupLockedUntil);
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

	private async ensureRewardClaimable(rewardId: string): Promise<{ id: string; title: string; expiryDate: bigint }> {
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
