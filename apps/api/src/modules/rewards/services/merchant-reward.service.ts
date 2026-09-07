import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { MerchantCreateRewardInput, MerchantRedemptionListItem, MerchantRedemptionListQuery, MerchantUpdateRewardInput, PaginatedServiceResult, RewardResponse } from "@workspace/shared";
import { EpochMsSchema, RewardPlatformEventSchema } from "@workspace/shared";

import { paginateCursorListResult } from "../../../platform/persistence/cursor-list";
import { MerchantMemberRepository } from "../repositories/merchant-member.repository";
import { RewardClaimRepository } from "../repositories/reward-claim.repository";
import { RewardRedemptionRepository } from "../repositories/reward-redemption.repository";
import { RewardRepository } from "../repositories/reward.repository";
import { mapRewardToResponse } from "../utils/reward-mapper.util";
import { MerchantContextService } from "./merchant-context.service";
import { RewardNotificationService } from "./reward-notification.service";
import { RewardsPlatformEventsService } from "./rewards-platform-events.service";

const AUTO_PUBLISH_MS = 24 * 60 * 60 * 1000;
const REFERRER_REWARD_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class MerchantRewardService {
	public constructor(
		private readonly rewardRepository: RewardRepository,
		private readonly rewardClaimRepository: RewardClaimRepository,
		private readonly redemptionRepository: RewardRedemptionRepository,
		private readonly merchantMemberRepository: MerchantMemberRepository,
		private readonly merchantContext: MerchantContextService,
		private readonly notificationService: RewardNotificationService,
		private readonly rewardsPlatformEvents: RewardsPlatformEventsService,
	) {}

	public async listRewards(userId: string, merchantOrgId: string | undefined): Promise<RewardResponse[]> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		const rows = await this.rewardRepository.listConsumerByMerchantOrg(orgId);
		return rows.map((row) => mapRewardToResponse(row, row.merchantOrg));
	}

	public async createReward(userId: string, merchantOrgId: string | undefined, input: MerchantCreateRewardInput): Promise<RewardResponse> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		await this.merchantContext.requireCapability(userId, orgId, "merchant:manage_rewards");

		const referralsEnabled = input.referralsEnabled;
		const referralPoolTotal = referralsEnabled ? input.referralPoolTotal : null;
		const saveAsDraft = input.saveAsDraft;
		const now = Date.now();
		const autoPublishAt = saveAsDraft ? null : now + AUTO_PUBLISH_MS;

		const reward = await this.rewardRepository.createConsumerReward({
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
		});

		if (referralsEnabled && referralPoolTotal !== null && referralPoolTotal !== undefined) {
			const referrerTitle = input.referrerRewardTitle ?? `${input.title} — Referrer bonus`;
			const referrerExpiry = Math.min(input.expiryDate, Date.now() + REFERRER_REWARD_MAX_TTL_MS);

			const referrerReward = await this.rewardRepository.createReferrerReward({
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
			});

			await this.rewardRepository.updateReward(reward.id, { referrerReward: { connect: { id: referrerReward.id } } });
		}

		const refreshed = await this.rewardRepository.findUniqueOrThrowWithMerchantOrg(reward.id);
		return mapRewardToResponse(refreshed, refreshed.merchantOrg);
	}

	public async updateReward(userId: string, merchantOrgId: string | undefined, rewardId: string, input: MerchantUpdateRewardInput): Promise<RewardResponse> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		await this.merchantContext.requireCapability(userId, orgId, "merchant:manage_rewards");

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

		await this.rewardRepository.updateReward(reward.id, updateData);

		if (input.referrerRewardTitle !== undefined && reward.referrerRewardId !== null) {
			await this.rewardRepository.updateReward(reward.referrerRewardId, { title: input.referrerRewardTitle });
		}

		const refreshed = await this.rewardRepository.findUniqueOrThrowWithMerchantOrg(reward.id);
		return mapRewardToResponse(refreshed, refreshed.merchantOrg);
	}

	public async publishReward(userId: string, merchantOrgId: string | undefined, rewardId: string): Promise<RewardResponse> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		await this.merchantContext.requireCapability(userId, orgId, "merchant:manage_rewards");

		const reward = await this.findOrgConsumerReward(orgId, rewardId);

		if (reward.status !== "DRAFT") {
			throw new BadRequestException({ message: "Only draft rewards can be published", error: "REWARD_NOT_DRAFT" });
		}

		const now = Date.now();
		const autoPublishAt = now + AUTO_PUBLISH_MS;

		await this.rewardRepository.updateReward(reward.id, {
			status: "PENDING_REVIEW",
			submittedForReviewAt: now,
			autoPublishAt,
		});

		if (reward.referrerRewardId !== null) {
			await this.rewardRepository.updateReward(reward.referrerRewardId, {
				status: "PENDING_REVIEW",
				submittedForReviewAt: now,
				autoPublishAt,
			});
		}

		const refreshed = await this.rewardRepository.findUniqueOrThrowWithMerchantOrg(reward.id);
		return mapRewardToResponse(refreshed, refreshed.merchantOrg);
	}

	public async listRedemptions(
		userId: string,
		merchantOrgId: string | undefined,
		query: MerchantRedemptionListQuery,
	): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		const result = await this.redemptionRepository.listForMerchant(orgId, query);

		return paginateCursorListResult(
			{
				...result,
				items: result.items.map((row) => ({
					redemptionId: row.id,
					rewardTitle: row.claim.reward.title,
					redeemedAt: EpochMsSchema.parse(Number(row.redeemedAt)),
					terminalId: row.terminalId,
					redemptionMethod: row.redemptionMethod,
				})),
			},
			query,
		);
	}

	public async autoPublishPendingRewards(): Promise<number> {
		const now = Date.now();
		const pending = await this.rewardRepository.listPendingAutoPublish(now);

		for (const reward of pending) {
			await this.rewardRepository.autoPublishInTransaction(reward.id, reward.referrerRewardId, reward.merchantOrgId, now);

			this.rewardsPlatformEvents.emit(
				RewardPlatformEventSchema.parse({
					event: "reward.auto_published",
					actorUserId: null,
					merchantOrgId: reward.merchantOrgId,
					metadata: { rewardId: reward.id },
				}),
			);

			const owners = await this.merchantMemberRepository.listOwnersByOrgId(reward.merchantOrgId);

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
		const expiredClaims = await this.rewardClaimRepository.listExpiredPending({ isReferrerCredit: false, now, take: 200 });

		for (const claim of expiredClaims) {
			const expired = await this.rewardClaimRepository.expireClaimInTransaction(claim.id, claim.rewardId, claim.reward.merchantOrgId, false);

			if (!expired) {
				continue;
			}

			this.rewardsPlatformEvents.emit(
				RewardPlatformEventSchema.parse({
					event: "reward.claim_expired",
					actorUserId: claim.userId,
					merchantOrgId: claim.reward.merchantOrgId,
					metadata: { claimId: claim.id, isReferrerCredit: claim.isReferrerCredit },
				}),
			);
		}

		return expiredClaims.length;
	}

	public async expireReferrerClaims(): Promise<number> {
		const now = Date.now();
		const expiredClaims = await this.rewardClaimRepository.listExpiredPending({ isReferrerCredit: true, now, take: 200 });

		for (const claim of expiredClaims) {
			const expired = await this.rewardClaimRepository.expireClaimInTransaction(claim.id, claim.rewardId, claim.reward.merchantOrgId, true);

			if (!expired) {
				continue;
			}

			this.rewardsPlatformEvents.emit(
				RewardPlatformEventSchema.parse({
					event: "reward.claim_expired",
					actorUserId: claim.userId,
					merchantOrgId: claim.reward.merchantOrgId,
					metadata: { claimId: claim.id, isReferrerCredit: true },
				}),
			);
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
		const reward = await this.rewardRepository.findOrgConsumerReward(merchantOrgId, rewardId);

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		return reward;
	}
}
