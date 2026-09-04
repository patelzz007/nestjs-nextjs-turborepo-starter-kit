import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { CreateRewardClaimInput, RewardClaimCreatedResponse, RewardClaimListQuery, RewardClaimQrResponse, RewardClaimResponse, RewardType } from "@workspace/shared";
import { EpochMsSchema, RewardBackupCodeSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
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
		private readonly prisma: PrismaService,
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

		await this.otpService.verifyClaimOtp(userId, input.phone, input.otp, input.rewardId);

		const reward = await this.ensureRewardClaimable(input.rewardId);
		const now = Date.now();
		const claimExpiresAt = Math.min(now + CLAIM_TTL_MS, Number(reward.expiryDate));

		const reserved = await this.prisma.reward.updateMany({
			where: { id: reward.id, quantityRemaining: { gt: 0 } },
			data: {
				quantityRemaining: { decrement: 1 },
				quantityReserved: { increment: 1 },
				claimCount: { increment: 1 },
			},
		});

		if (reserved.count === 0) {
			throw new ConflictException({ message: "This reward just sold out", error: "REWARD_OUT_OF_STOCK" });
		}

		const token = generateOpaqueToken();
		const backupCode = generateBackupCode();

		let referralId: string | null = null;
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { pendingAttributionToken: true, pendingAttributionExpiresAt: true },
		});

		if (user?.pendingAttributionToken !== null && user?.pendingAttributionToken !== undefined) {
			const notExpired = user.pendingAttributionExpiresAt === null || Number(user.pendingAttributionExpiresAt) >= now;
			if (notExpired) {
				const referral = await this.prisma.rewardReferral.findFirst({
					where: {
						attributionToken: user.pendingAttributionToken,
						rewardId: reward.id,
						status: "PENDING",
					},
				});
				if (referral !== null) {
					referralId = referral.id;
					await this.prisma.rewardReferral.update({
						where: { id: referral.id },
						data: { refereeUserId: userId },
					});
				}
			}
		}

		const claim = await this.prisma.rewardClaim.create({
			data: {
				userId,
				rewardId: reward.id,
				referralId,
				redemptionTokenHash: sha256Hex(token),
				backupCodeHash: sha256Hex(backupCode),
				status: "PENDING",
				claimedAt: now,
				claimExpiresAt,
			},
		});

		await this.prisma.user.update({
			where: { id: userId },
			data: {
				phone: input.phone,
				phoneVerifiedAt: now,
				pendingAttributionToken: null,
				pendingAttributionExpiresAt: null,
			},
		});

		const claimResponse = mapClaimToResponse(claim, reward.title);

		return {
			claim: claimResponse,
			qrDeepLink: `/rewards/claims/${claim.id}/qr`,
			backupCode,
		};
	}

	public async listClaims(
		userId: string,
		query: RewardClaimListQuery,
	): Promise<{
		items: RewardClaimResponse[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNext: boolean;
		hasPrevious: boolean;
	}> {
		const page = query.page;
		const pageSize = query.limit;
		const skip = (page - 1) * pageSize;

		const where = {
			userId,
			isDeleted: false,
			...(query.status !== undefined ? { status: query.status } : {}),
		};

		const [rows, total] = await this.prisma.$transaction([
			this.prisma.rewardClaim.findMany({
				where,
				include: { reward: { select: { title: true } } },
				orderBy: { claimedAt: "desc" },
				skip,
				take: pageSize,
			}),
			this.prisma.rewardClaim.count({ where }),
		]);

		return {
			items: rows.map((row) => mapClaimToResponse(row, row.reward.title)),
			total,
			page,
			limit: pageSize,
			totalPages: pageSize === 0 ? 0 : Math.ceil(total / pageSize),
			hasNext: page * pageSize < total,
			hasPrevious: page > 1,
		};
	}

	public async getClaimQr(userId: string, claimId: string): Promise<RewardClaimQrResponse> {
		const claim = await this.prisma.rewardClaim.findFirst({
			where: { id: claimId, userId, isDeleted: false },
		});

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
		await this.prisma.rewardClaim.update({
			where: { id: claim.id },
			data: {
				redemptionTokenHash: sha256Hex(token),
				backupCodeHash: sha256Hex(backupCode),
			},
		});

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
			const claim = await this.prisma.rewardClaim.findFirst({
				where: { redemptionTokenHash: sha256Hex(token), isDeleted: false },
				include: { reward: true },
			});
			if (claim === null) {
				throw new NotFoundException({ message: "Invalid token", error: "REDEMPTION_TOKEN_INVALID" });
			}
			return { claim, reward: claim.reward };
		}

		if (backupCode !== undefined) {
			RewardBackupCodeSchema.parse(backupCode);
			const claim = await this.prisma.rewardClaim.findFirst({
				where: { backupCodeHash: sha256Hex(backupCode), isDeleted: false },
				include: { reward: true },
			});
			if (claim === null) {
				throw new NotFoundException({ message: "Invalid backup code", error: "REDEMPTION_TOKEN_INVALID" });
			}
			return { claim, reward: claim.reward };
		}

		throw new BadRequestException({ message: "token or backupCode required", error: "REDEMPTION_INPUT_REQUIRED" });
	}

	public async recordBackupFailure(claimId: string): Promise<void> {
		const claim = await this.prisma.rewardClaim.findUnique({ where: { id: claimId } });
		if (claim === null) {
			return;
		}

		const attempts = claim.backupFailedAttempts + 1;
		await this.prisma.rewardClaim.update({
			where: { id: claimId },
			data: {
				backupFailedAttempts: attempts,
				backupLockedUntil: attempts >= MAX_BACKUP_FAILURES ? Date.now() + BACKUP_LOCK_MS : claim.backupLockedUntil,
			},
		});
	}

	private async ensureRewardClaimable(rewardId: string): Promise<{ id: string; title: string; expiryDate: bigint }> {
		const reward = await this.prisma.reward.findFirst({
			where: {
				id: rewardId,
				isDeleted: false,
				status: "PUBLISHED",
				rewardKind: "CONSUMER",
			},
			select: { id: true, title: true, expiryDate: true, quantityRemaining: true },
		});

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
