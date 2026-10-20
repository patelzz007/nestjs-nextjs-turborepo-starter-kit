import type { Prisma } from "@prisma/client";
import { epochMs, RewardTypeSchema, type RewardResponse } from "@workspace/shared";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import type { FileReferencePort } from "../../../files/public-api";
import { RewardImagesInvalidError } from "../../domain/errors/reward.errors";
import type { TenantStoreFacts } from "../../domain/policies/reward-location-scope.policy";
import type {
	LegalAcceptanceCheck,
	TenantStoresPort,
	RewardAuditEntry,
	RewardAuditPort,
	RewardImageFilesPort,
	RewardRedemptionFacts,
	RewardRedemptionFactsPort,
	RewardViewPort,
} from "../../application/ports/rewards-transactional.ports";
import type { TenantDisplayAdapter } from "../adapters/tenant-display.adapter";
import { REWARD_RESPONSE_INCLUDE } from "./reward-list-queries";
import { mapRewardToResponse } from "./reward-response.mapper";

/**
 * Locks every image file of a write through the files context's `FileReferencePort` (rows locked
 * `FOR UPDATE` in this transaction) and checks each is one of this tenant's READY reward
 * images. File deletion takes the same lock, so a reward is never saved naming an image being
 * deleted, nor an image deleted while a save names it.
 */
export class RewardImageFilesAdapter implements RewardImageFilesPort {
	public constructor(private readonly files: FileReferencePort) {}

	public async lockUsable(tenantId: string, fileIds: readonly string[]): Promise<void> {
		if (fileIds.length === 0) {
			return;
		}
		const locked = await this.files.lockForBinding({ category: "REWARD_IMAGE", tenantId, uploadedById: null, fileIds });
		const usable = new Set(locked.filter((file) => file.status === "READY").map((file) => file.id));
		if (usable.size !== new Set(fileIds).size) {
			throw new RewardImagesInvalidError(fileIds.filter((fileId) => !usable.has(fileId)));
		}
	}
}

/** The tenant's live, active stores (reads `Location` until tenants publishes a store read port). */
export class PrismaTenantStoresAdapter implements TenantStoresPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async factsFor(tenantId: string, requestedLocationIds: readonly string[]): Promise<TenantStoreFacts> {
		const activeStore: Prisma.LocationWhereInput = { tenantId, isDeleted: false, status: "ACTIVE" };
		const [activeLocationCount, requested] = await Promise.all([
			this.db.location.count({ where: activeStore }),
			requestedLocationIds.length === 0
				? Promise.resolve([])
				: this.db.location.findMany({ where: { ...activeStore, id: { in: [...new Set(requestedLocationIds)] } }, select: { id: true } }),
		]);
		return { activeLocationCount, activeRequestedLocationIds: requested.map((row) => row.id) };
	}
}

/** A reward as the API returns it, read in the command's own transaction. */
export class PrismaRewardViewAdapter implements RewardViewPort {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly tenants: TenantDisplayAdapter,
		private readonly resolve: PublicUrlResolve,
	) {}

	public async getResponse(rewardId: string): Promise<RewardResponse> {
		const row = await this.db.reward.findUniqueOrThrow({ where: { id: rewardId }, include: REWARD_RESPONSE_INCLUDE });
		const tenants = await this.tenants.displayData([row.tenantId]);
		return mapRewardToResponse(row, tenants.get(row.tenantId), this.resolve);
	}
}

/**
 * Appends one reward audit row without reading it back. Audit rows are write-only for most
 * principals (an API key may insert its tenant's rows but never read them), and `create()`
 * issues `INSERT … RETURNING`, which Postgres checks against the SELECT policies too.
 */
export class PrismaRewardAuditWriter implements RewardAuditPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async append(entry: RewardAuditEntry): Promise<void> {
		await this.db.rewardAuditLog.createMany({
			data: [{ tenantId: entry.tenantId, actorUserId: entry.actorUserId, action: entry.action, metadata: entry.metadata }],
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
				tenantId: true,
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
			tenantId: reward.tenantId,
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
