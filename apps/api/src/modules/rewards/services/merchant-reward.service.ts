import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { MerchantCreateRewardInput, MerchantRedemptionListItem, MerchantRedemptionListQuery, MerchantUpdateRewardInput, RewardResponse } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { mapRewardToResponse } from "../utils/reward-mapper.util";
import { MerchantContextService } from "./merchant-context.service";
import { RewardNotificationService } from "./reward-notification.service";

const AUTO_PUBLISH_MS = 24 * 60 * 60 * 1000;
const REFERRER_REWARD_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class MerchantRewardService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly merchantContext: MerchantContextService,
		private readonly notificationService: RewardNotificationService,
	) {}

	public async listRewards(userId: string, merchantOrgId: string | undefined): Promise<RewardResponse[]> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);

		const rows = await this.prisma.reward.findMany({
			where: { merchantOrgId: orgId, isDeleted: false, rewardKind: "CONSUMER" },
			include: { merchantOrg: { select: { businessName: true } } },
			orderBy: { createdAt: "desc" },
		});

		return rows.map((row) => mapRewardToResponse(row, row.merchantOrg));
	}

	public async createReward(userId: string, merchantOrgId: string | undefined, input: MerchantCreateRewardInput): Promise<RewardResponse> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		await this.merchantContext.requireOwner(userId, orgId);

		const referralsEnabled = input.referralsEnabled;
		const referralPoolTotal = referralsEnabled ? input.referralPoolTotal : null;
		const saveAsDraft = input.saveAsDraft ?? true;
		const now = Date.now();
		const autoPublishAt = saveAsDraft ? null : now + AUTO_PUBLISH_MS;

		const reward = await this.prisma.reward.create({
			data: {
				merchantOrgId: orgId,
				title: input.title,
				description: input.description,
				rewardType: input.rewardType,
				rewardValue: input.rewardValue,
				termsConditions: input.termsConditions ?? null,
				rewardKind: "CONSUMER",
				category: input.category,
				placeholderImageKey: `category-${input.category}`,
				rules: input.rules ?? undefined,
				quantityTotal: input.quantityTotal,
				quantityRemaining: input.quantityTotal,
				startDate: input.startDate ?? null,
				expiryDate: input.expiryDate,
				status: saveAsDraft ? "DRAFT" : "PENDING_REVIEW",
				submittedForReviewAt: saveAsDraft ? null : now,
				autoPublishAt,
				referralsEnabled,
				referralPoolTotal,
				referralPoolRemaining: referralPoolTotal,
			},
			include: { merchantOrg: { select: { businessName: true } } },
		});

		if (referralsEnabled && referralPoolTotal !== null && referralPoolTotal !== undefined) {
			const referrerTitle = input.referrerRewardTitle ?? `${input.title} — Referrer bonus`;
			const referrerExpiry = Math.min(input.expiryDate, Date.now() + REFERRER_REWARD_MAX_TTL_MS);

			const referrerReward = await this.prisma.reward.create({
				data: {
					merchantOrgId: orgId,
					title: referrerTitle,
					description: `Referrer reward for ${input.title}`,
					rewardType: input.rewardType,
					rewardValue: input.rewardValue,
					termsConditions: input.termsConditions ?? null,
					rewardKind: "REFERRER",
					category: input.category,
					placeholderImageKey: `category-${input.category}`,
					quantityTotal: referralPoolTotal,
					quantityRemaining: referralPoolTotal,
					expiryDate: referrerExpiry,
					status: saveAsDraft ? "DRAFT" : "PENDING_REVIEW",
					submittedForReviewAt: saveAsDraft ? null : now,
					autoPublishAt,
					referralsEnabled: false,
					parentConsumerRewardId: reward.id,
				},
			});

			await this.prisma.reward.update({
				where: { id: reward.id },
				data: { referrerRewardId: referrerReward.id },
			});
		}

		const refreshed = await this.prisma.reward.findUniqueOrThrow({
			where: { id: reward.id },
			include: { merchantOrg: { select: { businessName: true } } },
		});

		return mapRewardToResponse(refreshed, refreshed.merchantOrg);
	}

	public async updateReward(userId: string, merchantOrgId: string | undefined, rewardId: string, input: MerchantUpdateRewardInput): Promise<RewardResponse> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		await this.merchantContext.requireOwner(userId, orgId);

		const reward = await this.findOrgConsumerReward(orgId, rewardId);

		if (reward.status !== "DRAFT" && reward.status !== "PENDING_REVIEW") {
			throw new BadRequestException({ message: "Reward cannot be edited in current status", error: "REWARD_NOT_EDITABLE" });
		}

		const updateData: Prisma.RewardUpdateInput = {
			...(input.title !== undefined ? { title: input.title } : {}),
			...(input.description !== undefined ? { description: input.description } : {}),
			...(input.rewardType !== undefined ? { rewardType: input.rewardType } : {}),
			...(input.rewardValue !== undefined ? { rewardValue: input.rewardValue } : {}),
			...(input.termsConditions !== undefined ? { termsConditions: input.termsConditions } : {}),
			...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
			...(input.expiryDate !== undefined ? { expiryDate: input.expiryDate } : {}),
			...(input.referralsEnabled !== undefined ? { referralsEnabled: input.referralsEnabled } : {}),
			...(input.rules !== undefined ? { rules: input.rules } : {}),
		};

		if (input.quantityTotal !== undefined) {
			const delta = input.quantityTotal - reward.quantityTotal;
			updateData.quantityTotal = input.quantityTotal;
			if (delta !== 0) {
				updateData.quantityRemaining = Math.max(0, reward.quantityRemaining + delta);
			}
		}

		if (input.referralPoolTotal !== undefined) {
			updateData.referralPoolTotal = input.referralPoolTotal;
			updateData.referralPoolRemaining = input.referralPoolTotal;
		}

		await this.prisma.reward.update({
			where: { id: reward.id },
			data: updateData,
		});

		if (input.referrerRewardTitle !== undefined && reward.referrerRewardId !== null) {
			await this.prisma.reward.update({
				where: { id: reward.referrerRewardId },
				data: { title: input.referrerRewardTitle },
			});
		}

		const refreshed = await this.prisma.reward.findUniqueOrThrow({
			where: { id: reward.id },
			include: { merchantOrg: { select: { businessName: true } } },
		});

		return mapRewardToResponse(refreshed, refreshed.merchantOrg);
	}

	public async publishReward(userId: string, merchantOrgId: string | undefined, rewardId: string): Promise<RewardResponse> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		await this.merchantContext.requireOwner(userId, orgId);

		const reward = await this.findOrgConsumerReward(orgId, rewardId);

		if (reward.status !== "DRAFT") {
			throw new BadRequestException({ message: "Only draft rewards can be published", error: "REWARD_NOT_DRAFT" });
		}

		const now = Date.now();
		const autoPublishAt = now + AUTO_PUBLISH_MS;

		await this.prisma.reward.update({
			where: { id: reward.id },
			data: {
				status: "PENDING_REVIEW",
				submittedForReviewAt: now,
				autoPublishAt,
			},
		});

		if (reward.referrerRewardId !== null) {
			await this.prisma.reward.update({
				where: { id: reward.referrerRewardId },
				data: {
					status: "PENDING_REVIEW",
					submittedForReviewAt: now,
					autoPublishAt,
				},
			});
		}

		const refreshed = await this.prisma.reward.findUniqueOrThrow({
			where: { id: reward.id },
			include: { merchantOrg: { select: { businessName: true } } },
		});

		return mapRewardToResponse(refreshed, refreshed.merchantOrg);
	}

	public async listRedemptions(
		userId: string,
		merchantOrgId: string | undefined,
		query: MerchantRedemptionListQuery,
	): Promise<{
		items: MerchantRedemptionListItem[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNext: boolean;
		hasPrevious: boolean;
	}> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);

		const page = query.page;
		const pageSize = query.limit;
		const skip = (page - 1) * pageSize;

		const where = { merchantOrgId: orgId, isDeleted: false };

		const [rows, total] = await this.prisma.$transaction([
			this.prisma.rewardRedemption.findMany({
				where,
				include: { claim: { include: { reward: { select: { title: true } } } } },
				orderBy: { redeemedAt: "desc" },
				skip,
				take: pageSize,
			}),
			this.prisma.rewardRedemption.count({ where }),
		]);

		return {
			items: rows.map((row) => ({
				redemptionId: row.id,
				rewardTitle: row.claim.reward.title,
				redeemedAt: EpochMsSchema.parse(Number(row.redeemedAt)),
				terminalId: row.terminalId,
				redemptionMethod: row.redemptionMethod,
			})),
			total,
			page,
			limit: pageSize,
			totalPages: pageSize === 0 ? 0 : Math.ceil(total / pageSize),
			hasNext: page * pageSize < total,
			hasPrevious: page > 1,
		};
	}

	public async autoPublishPendingRewards(): Promise<number> {
		const now = Date.now();
		const pending = await this.prisma.reward.findMany({
			where: {
				status: "PENDING_REVIEW",
				autoPublishAt: { lte: now },
				isDeleted: false,
				rewardKind: "CONSUMER",
			},
			include: { merchantOrg: { select: { businessName: true } } },
		});

		for (const reward of pending) {
			await this.prisma.$transaction(async (tx) => {
				await tx.reward.update({
					where: { id: reward.id },
					data: {
						status: "PUBLISHED",
						reviewedAt: now,
						autoPublishAt: null,
					},
				});

				if (reward.referrerRewardId !== null) {
					await tx.reward.update({
						where: { id: reward.referrerRewardId },
						data: { status: "PUBLISHED", reviewedAt: now, autoPublishAt: null },
					});
				}

				await tx.rewardAuditLog.create({
					data: {
						merchantOrgId: reward.merchantOrgId,
						action: "reward.auto_published",
						metadata: { rewardId: reward.id },
					},
				});
			});

			const owners = await this.prisma.merchantMember.findMany({
				where: { merchantOrgId: reward.merchantOrgId, role: "OWNER", isDeleted: false },
			});

			for (const owner of owners) {
				await this.notificationService.notify(owner.userId, "reward_auto_published", "Reward published", `"${reward.title}" was auto-published after the 24h review window.`, {
					rewardId: reward.id,
				});
			}
		}

		return pending.length;
	}

	public async expirePendingClaims(): Promise<number> {
		const now = Date.now();
		const expiredClaims = await this.prisma.rewardClaim.findMany({
			where: {
				status: "PENDING",
				claimExpiresAt: { lt: now },
				isDeleted: false,
			},
			include: { reward: true },
			take: 200,
		});

		for (const claim of expiredClaims) {
			await this.prisma.$transaction(async (tx) => {
				const updated = await tx.rewardClaim.updateMany({
					where: { id: claim.id, status: "PENDING" },
					data: { status: "EXPIRED" },
				});

				if (updated.count === 0) {
					return;
				}

				await tx.reward.update({
					where: { id: claim.rewardId },
					data: {
						quantityReserved: { decrement: 1 },
						quantityRemaining: { increment: 1 },
					},
				});

				await tx.rewardAuditLog.create({
					data: {
						merchantOrgId: claim.reward.merchantOrgId,
						action: "reward.claim_expired",
						metadata: { claimId: claim.id },
					},
				});
			});
		}

		return expiredClaims.length;
	}

	private async findOrgConsumerReward(
		merchantOrgId: string,
		rewardId: string,
	): Promise<{
		id: string;
		status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "DISABLED";
		referrerRewardId: string | null;
		quantityTotal: number;
		quantityRemaining: number;
	}> {
		const reward = await this.prisma.reward.findFirst({
			where: { id: rewardId, merchantOrgId, isDeleted: false, rewardKind: "CONSUMER" },
			select: { id: true, status: true, referrerRewardId: true, quantityTotal: true, quantityRemaining: true },
		});

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		return reward;
	}
}
