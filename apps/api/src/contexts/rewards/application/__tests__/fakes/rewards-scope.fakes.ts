import { epochMs, RewardStatusSchema, type RewardResponse } from "@workspace/shared";

import { RecordingEventCollector } from "../../../../../platform/application/__tests__/fakes/recording-event-collector";
import type { LegalAcceptance } from "../../../domain/aggregates/legal-acceptance.aggregate";
import { RewardImagesInvalidError } from "../../../domain/errors/reward.errors";
import type { TenantStoreFacts } from "../../../domain/policies/reward-location-scope.policy";
import type { LegalAcceptanceRepository } from "../../../domain/repositories/legal-acceptance.repository";
import type { TenantStoresPort, RewardAuditEntry, RewardAuditPort, RewardImageFilesPort, RewardViewPort } from "../../ports/rewards-transactional.ports";
import type { IdGenerator } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { InMemoryRewardRepository } from "./in-memory-reward.repository";

/** Files that are usable reward images; anything else is refused like the files adapter refuses it. */
export class FakeRewardImageFiles implements RewardImageFilesPort {
	public readonly locks: { readonly tenantId: string; readonly fileIds: readonly string[] }[] = [];
	public readonly usable: Set<string> = new Set<string>();

	public lockUsable(tenantId: string, fileIds: readonly string[]): Promise<void> {
		if (fileIds.length === 0) {
			return Promise.resolve();
		}
		this.locks.push({ tenantId, fileIds });
		const unusable = fileIds.filter((fileId) => !this.usable.has(fileId));
		return unusable.length === 0 ? Promise.resolve() : Promise.reject(new RewardImagesInvalidError(unusable));
	}
}

/** A fixed set of active stores. */
export class FakeTenantStores implements TenantStoresPort {
	public constructor(private readonly activeLocationIds: readonly string[] = []) {}

	public factsFor(_tenantId: string, requestedLocationIds: readonly string[]): Promise<TenantStoreFacts> {
		return Promise.resolve({
			activeLocationCount: this.activeLocationIds.length,
			activeRequestedLocationIds: requestedLocationIds.filter((locationId) => this.activeLocationIds.includes(locationId)),
		});
	}
}

/** Answers the stored reward's id, status and title — enough for handlers that return the view. */
export class FakeRewardViews implements RewardViewPort {
	public constructor(private readonly rewards: InMemoryRewardRepository) {}

	public getResponse(rewardId: string): Promise<RewardResponse> {
		const row = this.rewards.rows.get(rewardId);
		if (row === undefined) {
			return Promise.reject(new Error(`No reward ${rewardId}`));
		}
		return Promise.resolve(fakeRewardResponse(row.id, row.tenantId, row.status, row.title));
	}
}

/** A contract-shaped reward response for handler tests (only identity, status and title matter there). */
export function fakeRewardResponse(id: string, tenantId: string, status: string, title: string): RewardResponse {
	return {
		id,
		tenantId,
		tenantName: undefined,
		tenantLogoUrl: null,
		tenantLogoSources: [],
		title,
		description: "",
		rewardType: "FREE_ITEM",
		rewardValue: 0,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "cafe",
		images: [],
		quantityTotal: 1,
		quantityRemaining: 1,
		quantityReserved: 0,
		startDate: null,
		expiryDate: epochMs(0),
		status: RewardStatusSchema.parse(status),
		claimCount: 0,
		redemptionCount: 0,
		referralsEnabled: false,
		referralPoolTotal: null,
		referralPoolRemaining: null,
		referrerRewardId: null,
		rules: null,
		locationScopeType: "ALL_LOCATIONS",
		locationIds: [],
		locationNames: undefined,
		createdAt: epochMs(0),
		updatedAt: epochMs(0),
		isDeleted: false,
		deletedAt: null,
	};
}

export class RecordingRewardAudit implements RewardAuditPort {
	public readonly entries: RewardAuditEntry[] = [];

	public append(entry: RewardAuditEntry): Promise<void> {
		this.entries.push(entry);
		return Promise.resolve();
	}
}

export class InMemoryLegalAcceptances implements LegalAcceptanceRepository {
	public readonly added: LegalAcceptance[] = [];

	public add(acceptance: LegalAcceptance): Promise<void> {
		this.added.push(acceptance);
		return Promise.resolve();
	}
}

/** Sequential UUID-shaped ids, so tests know every id a handler generates. */
export class SequentialIds implements IdGenerator {
	private counter = 0;

	public next(): string {
		this.counter += 1;
		return `00000000-0000-4000-8000-${String(this.counter).padStart(12, "0")}`;
	}
}

/** A complete rewards scope of fakes. */
export interface FakeRewardsScope extends RewardsScope {
	readonly rewards: InMemoryRewardRepository;
	readonly legalAcceptances: InMemoryLegalAcceptances;
	readonly imageFiles: FakeRewardImageFiles;
	readonly audit: RecordingRewardAudit;
	readonly events: RecordingEventCollector;
}

export function fakeRewardsScope(activeLocationIds: readonly string[] = []): FakeRewardsScope {
	const rewards = new InMemoryRewardRepository();
	return {
		rewards,
		legalAcceptances: new InMemoryLegalAcceptances(),
		imageFiles: new FakeRewardImageFiles(),
		stores: new FakeTenantStores(activeLocationIds),
		views: new FakeRewardViews(rewards),
		audit: new RecordingRewardAudit(),
		events: new RecordingEventCollector(),
	};
}
