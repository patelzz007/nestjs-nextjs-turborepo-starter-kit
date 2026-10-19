import type { Prisma } from "@prisma/client";
import { epochMs, RewardTypeSchema, type RewardResponse } from "@workspace/shared";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import type { FileReferencePort } from "../../../files/public-api";
import { RewardImagesInvalidError } from "../../domain/errors/reward.errors";
import type { OrganizationStoreFacts } from "../../domain/policies/reward-location-scope.policy";
import type {
	LegalAcceptanceCheck,
	OrganizationStoresPort,
	RewardAuditEntry,
	RewardAuditPort,
	RewardImageFilesPort,
	RewardRedemptionFacts,
	RewardRedemptionFactsPort,
	RewardViewPort,
} from "../../application/ports/rewards-transactional.ports";
import type { OrganizationDisplayAdapter } from "../adapters/organization-display.adapter";
import { REWARD_RESPONSE_INCLUDE } from "./reward-list-queries";
import { mapRewardToResponse } from "./reward-response.mapper";

/**
 * Locks every image file of a write through the files context's `FileReferencePort` (rows locked
 * `FOR UPDATE` in this transaction) and checks each is one of this organization's READY reward
 * images. File deletion takes the same lock, so a reward is never saved naming an image being
 * deleted, nor an image deleted while a save names it.
 */
export class RewardImageFilesAdapter implements RewardImageFilesPort {
	public constructor(private readonly files: FileReferencePort) {}

	public async lockUsable(organizationId: string, fileIds: readonly string[]): Promise<void> {
		if (fileIds.length === 0) {
			return;
		}
		const locked = await this.files.lockForBinding({ category: "REWARD_IMAGE", organizationId, uploadedById: null, fileIds });
		const usable = new Set(locked.filter((file) => file.status === "READY").map((file) => file.id));
		if (usable.size !== new Set(fileIds).size) {
			throw new RewardImagesInvalidError(fileIds.filter((fileId) => !usable.has(fileId)));
		}
	}
}

/** The organization's live, active stores (reads `OrganizationLocation` until organizations publishes a store read port). */
export class PrismaOrganizationStoresAdapter implements OrganizationStoresPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async factsFor(organizationId: string, requestedLocationIds: readonly string[]): Promise<OrganizationStoreFacts> {
		const activeStore: Prisma.OrganizationLocationWhereInput = { organizationId, isDeleted: false, status: "ACTIVE" };
		const [activeLocationCount, requested] = await Promise.all([
			this.db.organizationLocation.count({ where: activeStore }),
			requestedLocationIds.length === 0
				? Promise.resolve([])
				: this.db.organizationLocation.findMany({ where: { ...activeStore, id: { in: [...new Set(requestedLocationIds)] } }, select: { id: true } }),
		]);
		return { activeLocationCount, activeRequestedLocationIds: requested.map((row) => row.id) };
	}
}

/** A reward as the API returns it, read in the command's own transaction. */
export class PrismaRewardViewAdapter implements RewardViewPort {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly organizations: OrganizationDisplayAdapter,
		private readonly resolve: PublicUrlResolve,
	) {}

	public async getResponse(rewardId: string): Promise<RewardResponse> {
		const row = await this.db.reward.findUniqueOrThrow({ where: { id: rewardId }, include: REWARD_RESPONSE_INCLUDE });
		const organizations = await this.organizations.displayData([row.organizationId]);
		return mapRewardToResponse(row, organizations.get(row.organizationId), this.resolve);
	}
}

/**
 * Appends one reward audit row without reading it back. Audit rows are write-only for most
 * principals (an API key may insert its organization's rows but never read them), and `create()`
 * issues `INSERT … RETURNING`, which Postgres checks against the SELECT policies too.
 */
export class PrismaRewardAuditWriter implements RewardAuditPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async append(entry: RewardAuditEntry): Promise<void> {
		await this.db.rewardAuditLog.createMany({
			data: [{ organizationId: entry.organizationId, actorUserId: entry.actorUserId, action: entry.action, metadata: entry.metadata }],
		});
	}
}

/** Live legal acceptances (any version counts, as today). */
export class PrismaLegalAcceptanceCheck implements LegalAcceptanceCheck {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async hasAccepted(userId: string): Promise<boolean> {
		const row = await this.db.rewardLegalAcceptance.findFirst({ where: { userId, isDeleted: false }, select: { id: true } });
		return row !== null;
	}
}

/**
 * A reward's redemption facts; a soft-deleted reward has none (validate and checkout answer its code
 * alike, as unknown), and closed (soft-deleted) stores never count as a place it can be redeemed.
 */
export class PrismaRewardRedemptionFacts implements RewardRedemptionFactsPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async factsFor(rewardId: string): Promise<RewardRedemptionFacts | null> {
		const reward = await this.db.reward.findFirst({
			where: { id: rewardId, isDeleted: false },
			select: {
				id: true,
				organizationId: true,
				title: true,
				rewardType: true,
				expiryDate: true,
				locationScopeType: true,
				minSpendMinor: true,
				locationScopes: { where: { location: { isDeleted: false } }, select: { locationId: true } },
			},
		});
		if (reward === null) {
			return null;
		}
		return {
			id: reward.id,
			organizationId: reward.organizationId,
			title: reward.title,
			rewardType: RewardTypeSchema.parse(reward.rewardType),
			expiryDate: epochMs(Number(reward.expiryDate)),
			locationScopeType: reward.locationScopeType,
			locationIds: reward.locationScopes.map((scope) => scope.locationId),
			minSpendMinor: reward.minSpendMinor,
		};
	}

	public async titlesOf(rewardIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		if (rewardIds.length === 0) {
			return new Map();
		}
		const rows = await this.db.reward.findMany({ where: { id: { in: [...new Set(rewardIds)] } }, select: { id: true, title: true } });
		return new Map(rows.map((row): [string, string] => [row.id, row.title]));
	}
}
