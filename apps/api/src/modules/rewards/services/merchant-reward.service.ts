import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type {
	MerchantCreateRewardInput,
	MerchantRedemptionListItem,
	MerchantRedemptionListQuery,
	MerchantRewardListQuery,
	MerchantUpdateRewardInput,
	OrganizationLocationScopeType,
	PaginatedServiceResult,
	RewardPlatformEvent,
	RewardResponse,
} from "@workspace/shared";
import { EpochMsSchema, RewardPlatformEventSchema } from "@workspace/shared";

import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { RewardClaimRepository } from "../repositories/reward-claim.repository";
import { RewardRedemptionRepository } from "../repositories/reward-redemption.repository";
import { RewardRepository } from "../repositories/reward.repository";
import { mapRewardToResponse } from "../utils/reward-mapper.util";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { MerchantContextService } from "./merchant-context.service";
import { RewardNotificationService } from "./reward-notification.service";

const AUTO_PUBLISH_MS = 24 * 60 * 60 * 1000;
const REFERRER_REWARD_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class MerchantRewardService {
	public constructor(
		private readonly rewardRepository: RewardRepository,
		private readonly rewardClaimRepository: RewardClaimRepository,
		private readonly redemptionRepository: RewardRedemptionRepository,
		private readonly merchantContext: MerchantContextService,
		private readonly organizationRepository: OrganizationRepository,
		private readonly notificationService: RewardNotificationService,
		private readonly outbox: PlatformOutboxService,
	) {}

	public async listRewards(actor: MerchantActor, query: MerchantRewardListQuery = {}): Promise<RewardResponse[]> {
		await this.merchantContext.requireActorCapability(actor, "merchant:view_rewards");
		const locationId = await this.merchantContext.resolveLocationFilter(actor, query.locationId);
		const rows = await this.rewardRepository.listConsumerByOrganization(actor.organizationId, locationId);
		return rows.map((row) => mapRewardToResponse(row, row.organization));
	}

	public async createReward(actor: MerchantActor, input: MerchantCreateRewardInput): Promise<RewardResponse> {
		await this.merchantContext.requireActorCapability(actor, "merchant:manage_rewards");
		const orgId = actor.organizationId;
		const { locationScopeType, locationIds } = await this.resolveRewardLocationScope(actor, input.locationScopeType, input.locationIds);

		const referralsEnabled = input.referralsEnabled;
		// The contract requires `referralPoolTotal` whenever referrals are enabled; an
		// absent pool is stored as SQL NULL (the column's default) either way.
		const referralPoolTotal: number | null = referralsEnabled ? (input.referralPoolTotal ?? null) : null;
		const saveAsDraft = input.saveAsDraft;
		const now = Date.now();
		const autoPublishAt = saveAsDraft ? null : now + AUTO_PUBLISH_MS;

		const reward = await this.rewardRepository.createConsumerReward(
			{
				organizationId: orgId,
				title: input.title,
				description: input.description,
				rewardType: input.rewardType,
				rewardValue: input.rewardValue,
				termsConditions: input.termsConditions ?? null,
				rewardKind: "CONSUMER",
				category: input.category,
				placeholderImageKey: `category-${input.category}`,
				...(input.rules === undefined ? {} : { rules: input.rules }),
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
				locationScopeType,
			},
			locationIds,
		);

		if (referralsEnabled && referralPoolTotal !== null) {
			const referrerTitle = input.referrerRewardTitle ?? `${input.title} — Referrer bonus`;
			const referrerExpiry = Math.min(input.expiryDate, Date.now() + REFERRER_REWARD_MAX_TTL_MS);

			const referrerReward = await this.rewardRepository.createReferrerReward({
				organizationId: orgId,
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
				locationScopeType,
			});

			if (locationScopeType === "SELECTED" && locationIds.length > 0) {
				await this.rewardRepository.replaceLocationScopes(referrerReward.id, orgId, locationIds);
			}

			await this.rewardRepository.updateReward(reward.id, { referrerReward: { connect: { id: referrerReward.id } } });
		}

		const refreshed = await this.rewardRepository.findUniqueOrThrowWithOrganization(reward.id);
		return mapRewardToResponse(refreshed, refreshed.organization);
	}

	private async resolveRewardLocationScope(
		actor: MerchantActor,
		requestedScopeType: OrganizationLocationScopeType,
		requestedLocationIds: readonly string[],
	): Promise<{ readonly locationScopeType: OrganizationLocationScopeType; readonly locationIds: string[] }> {
		const locationCount = await this.rewardRepository.countOrganizationLocations(actor.organizationId);

		if (locationCount <= 1) {
			return { locationScopeType: "ALL_LOCATIONS", locationIds: [] };
		}

		if (requestedScopeType === "ALL_LOCATIONS") {
			return { locationScopeType: "ALL_LOCATIONS", locationIds: [] };
		}

		const uniqueLocationIds = [...new Set(requestedLocationIds)];
		const validLocationIds = await this.rewardRepository.findOrganizationLocationIds(actor.organizationId, uniqueLocationIds);

		if (validLocationIds.length !== uniqueLocationIds.length) {
			throw new BadRequestException({
				message: "One or more selected stores are invalid for this organization",
				error: "REWARD_LOCATION_INVALID",
			});
		}

		if (actor.kind === "user" && actor.userId !== null && actor.orgSlug !== null) {
			for (const locationId of validLocationIds) {
				await this.merchantContext.assertAccessibleLocationForUser(actor.userId, actor.orgSlug, locationId);
			}
		}

		return { locationScopeType: "SELECTED", locationIds: validLocationIds };
	}

	public async updateReward(actor: MerchantActor, rewardId: string, input: MerchantUpdateRewardInput): Promise<RewardResponse> {
		await this.merchantContext.requireActorCapability(actor, "merchant:manage_rewards");
		const orgId = actor.organizationId;

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

		const refreshed = await this.rewardRepository.findUniqueOrThrowWithOrganization(reward.id);
		return mapRewardToResponse(refreshed, refreshed.organization);
	}

	public async publishReward(actor: MerchantActor, rewardId: string): Promise<RewardResponse> {
		await this.merchantContext.requireActorCapability(actor, "merchant:manage_rewards");
		const orgId = actor.organizationId;

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

		const refreshed = await this.rewardRepository.findUniqueOrThrowWithOrganization(reward.id);
		return mapRewardToResponse(refreshed, refreshed.organization);
	}

	public async listRedemptions(actor: MerchantActor, query: MerchantRedemptionListQuery): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> {
		await this.merchantContext.requireActorCapability(actor, "merchant:view_redemptions");
		const locationId = await this.merchantContext.resolveLocationFilter(actor, query.locationId);
		const result = await this.redemptionRepository.listForMerchant(actor.organizationId, locationId, query);

		return toPaginatedServiceResult(
			mapListResult(result, (row) => ({
				redemptionId: row.id,
				rewardTitle: row.claim.reward.title,
				redeemedAt: EpochMsSchema.parse(Number(row.redeemedAt)),
				terminalId: row.terminalId,
				redemptionMethod: row.redemptionMethod,
			})),
			query,
		);
	}

	public async autoPublishPendingRewards(): Promise<number> {
		const now = Date.now();
		const pending = await this.rewardRepository.listPendingAutoPublish(now);

		for (const reward of pending) {
			const event = RewardPlatformEventSchema.parse({
				event: "reward.auto_published",
				actorUserId: null,
				organizationId: reward.organizationId,
				metadata: { rewardId: reward.id },
			});
			await this.rewardRepository.autoPublishInTransaction(reward.id, reward.referrerRewardId, reward.organizationId, now, async (tx): Promise<void> => {
				await this.enqueueRewardEvent(tx, event);
			});

			const ownerUserIds = await this.organizationRepository.listOwnerUserIds(reward.organizationId);

			for (const ownerUserId of ownerUserIds) {
				await this.notificationService.notify(ownerUserId, "reward_auto_published", "Reward published", `"${reward.title}" was auto-published after the 24h review window.`, {
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
			const event = RewardPlatformEventSchema.parse({
				event: "reward.claim_expired",
				actorUserId: claim.userId,
				organizationId: claim.reward.organizationId,
				metadata: { claimId: claim.id, isReferrerCredit: claim.isReferrerCredit },
			});
			await this.rewardClaimRepository.expireClaimInTransaction(claim.id, claim.rewardId, claim.reward.organizationId, false, async (tx): Promise<void> => {
				await this.enqueueRewardEvent(tx, event);
			});
		}

		return expiredClaims.length;
	}

	public async expireReferrerClaims(): Promise<number> {
		const now = Date.now();
		const expiredClaims = await this.rewardClaimRepository.listExpiredPending({ isReferrerCredit: true, now, take: 200 });

		for (const claim of expiredClaims) {
			const event = RewardPlatformEventSchema.parse({
				event: "reward.claim_expired",
				actorUserId: claim.userId,
				organizationId: claim.reward.organizationId,
				metadata: { claimId: claim.id, isReferrerCredit: true },
			});
			await this.rewardClaimRepository.expireClaimInTransaction(claim.id, claim.rewardId, claim.reward.organizationId, true, async (tx): Promise<void> => {
				await this.enqueueRewardEvent(tx, event);
			});
		}

		return expiredClaims.length;
	}

	/** Same-transaction outbox write for a reward state change (see `PlatformOutboxService`). */
	private async enqueueRewardEvent(tx: Prisma.TransactionClient, payload: RewardPlatformEvent): Promise<void> {
		await this.outbox.enqueueInTransaction(tx, { type: "reward.platform", payload });
	}

	private async findOrgConsumerReward(
		organizationId: string,
		rewardId: string,
	): Promise<{
		id: string;
		status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "DISABLED";
		referrerRewardId: string | null;
		quantityTotal: number;
		quantityRemaining: number;
	}> {
		const reward = await this.rewardRepository.findOrgConsumerReward(organizationId, rewardId);

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		return reward;
	}
}
