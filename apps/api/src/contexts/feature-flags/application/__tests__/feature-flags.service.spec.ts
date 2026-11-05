import { epochMs, FEATURE_FLAG_STORE_SEARCH_LIMIT, type EpochMs, type FeatureFlagKey, type FeatureFlagStoreOption, type StoreFeatureFlagKey } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { FeatureFlagOverrideNotFoundError, FeatureFlagStoreNotFoundError } from "../../domain/errors/feature-flag.errors";
import type { FeatureFlagChange, FeatureFlagRecord, FeatureFlagStore, StoreOverrideChange, StoreOverrideRecord } from "../ports/feature-flag.store";
import { FeatureFlagsService } from "../services/feature-flags.service";

const NOW = epochMs(Date.UTC(2026, 10, 3, 12, 0));
const ACTOR: ActorContext = { kind: "anonymous", tenantId: null, request: { requestId: "req-1", ip: "198.51.100.7", userAgent: "agent", deviceLabel: null, endpoint: null } };

class FakeStore implements FeatureFlagStore {
	public readonly saved: { readonly key: FeatureFlagKey; readonly change: FeatureFlagChange }[] = [];
	public readonly asked: boolean[] = [];

	public constructor(private readonly records: readonly FeatureFlagRecord[]) {}

	public settings(_actor: ActorContext, names: boolean): Promise<readonly FeatureFlagRecord[]> {
		this.asked.push(names);
		return Promise.resolve(this.records);
	}

	public save(_actor: ActorContext, key: FeatureFlagKey, change: FeatureFlagChange): Promise<FeatureFlagRecord> {
		this.saved.push({ key, change });
		return Promise.resolve({ key, mode: change.mode, percentage: change.percentage, reason: change.reason, updatedAt: change.at, updatedByName: "Sam" });
	}

	public readonly overrides: StoreOverrideRecord[] = [];
	/** Stores the fake knows: a merchant and its branches. */
	public readonly stores = new Map<string, readonly string[]>([[MERCHANT, [BRANCH]]]);

	// One store flag exists today, so the fake keeps every override under it.
	public storeOverrides(_actor: ActorContext, _key: StoreFeatureFlagKey): Promise<readonly StoreOverrideRecord[]> {
		return Promise.resolve(this.overrides);
	}

	public setStoreOverride(_actor: ActorContext, key: StoreFeatureFlagKey, change: StoreOverrideChange): Promise<StoreOverrideRecord | null> {
		const branches = this.stores.get(change.tenantId);
		if (branches === undefined || (change.locationId !== null && !branches.includes(change.locationId))) {
			return Promise.resolve(null);
		}
		const record: StoreOverrideRecord = {
			id: OVERRIDE_ID,
			key,
			tenantId: change.tenantId,
			tenantName: "Jonker Street Kitchen",
			locationId: change.locationId,
			locationName: change.locationId === null ? null : "Bukit Katil",
			enabled: change.enabled,
			reason: change.reason,
			updatedAt: change.at,
			updatedByName: "Sam",
		};
		this.overrides.push(record);
		return Promise.resolve(record);
	}

	public searchStores(_actor: ActorContext, search: string, limit: number): Promise<readonly FeatureFlagStoreOption[]> {
		this.searched.push({ search, limit });
		return Promise.resolve([{ tenantId: MERCHANT, tenantName: "Jonker Street Kitchen", branches: [{ locationId: BRANCH, name: "Bukit Katil" }] }]);
	}

	public readonly searched: { readonly search: string; readonly limit: number }[] = [];

	public removeStoreOverride(_actor: ActorContext, _key: StoreFeatureFlagKey, overrideId: string): Promise<boolean> {
		const index = this.overrides.findIndex((override) => override.id === overrideId);
		if (index < 0) {
			return Promise.resolve(false);
		}
		this.overrides.splice(index, 1);
		return Promise.resolve(true);
	}
}

const MERCHANT = "0190f0e0-0000-7000-8000-000000000001";
const BRANCH = "0190f0e0-0000-7000-8000-000000000002";
const OVERRIDE_ID = "0190f0e0-0000-7000-8000-000000000003";

const clock = { now: (): EpochMs => NOW };
const GALLERY_ON: FeatureFlagRecord = { key: "component-gallery", mode: "ON", percentage: null, reason: "Everyone", updatedAt: NOW, updatedByName: "Ann" };

describe("FeatureFlagsService", () => {
	it("lists every declared flag, DEFAULT where nothing is stored, with names", async () => {
		const store = new FakeStore([GALLERY_ON]);
		const { flags } = await new FeatureFlagsService(store, clock).list(ACTOR);
		expect(flags.map((flag) => [flag.key, flag.mode, flag.updatedByName])).toStrictEqual([
			["component-gallery", "ON", "Ann"],
			["merchant-invites", "DEFAULT", null],
			["till-redemption", "DEFAULT", null],
		]);
		expect(flags.map((flag) => flag.scope)).toStrictEqual(["platform", "platform", "store"]);
		expect(store.asked).toStrictEqual([true]);
	});

	it("answers the bare settings without reading names", async () => {
		const store = new FakeStore([GALLERY_ON]);
		await expect(new FeatureFlagsService(store, clock).settings(ACTOR)).resolves.toStrictEqual({
			settings: [
				{ key: "component-gallery", mode: "ON", percentage: null },
				{ key: "merchant-invites", mode: "DEFAULT", percentage: null },
				{ key: "till-redemption", mode: "DEFAULT", percentage: null },
			],
		});
		expect(store.asked).toStrictEqual([false]);
	});

	it("saves a change at the clock's time and answers the flag", async () => {
		const store = new FakeStore([]);
		const flag = await new FeatureFlagsService(store, clock).update(ACTOR, "merchant-invites", { mode: "PERCENTAGE", percentage: 25, reason: "A quarter first" });
		expect(store.saved).toStrictEqual([{ key: "merchant-invites", change: { mode: "PERCENTAGE", percentage: 25, reason: "A quarter first", at: NOW } }]);
		expect(flag).toMatchObject({ key: "merchant-invites", title: "Merchant invites", mode: "PERCENTAGE", percentage: 25, updatedByName: "Sam" });
	});

	it("sets a branch's own value at the clock's time, and refuses a store that isn't the merchant's (enhancement 5.11)", async () => {
		const store = new FakeStore([]);
		const service = new FeatureFlagsService(store, clock);
		await expect(
			service.setStoreOverride(ACTOR, "till-redemption", { tenantId: MERCHANT, locationId: BRANCH, enabled: false, reason: "Tills being replaced" }),
		).resolves.toMatchObject({
			locationName: "Bukit Katil",
			enabled: false,
			updatedAt: NOW,
		});
		await expect(
			service.setStoreOverride(ACTOR, "till-redemption", { tenantId: MERCHANT, locationId: MERCHANT, enabled: true, reason: "Not one of its branches" }),
		).rejects.toThrow(FeatureFlagStoreNotFoundError);
		expect((await service.storeOverrides(ACTOR, "till-redemption")).overrides).toHaveLength(1);
	});

	it("removes a store's setting, and says when there is none", async () => {
		const store = new FakeStore([]);
		const service = new FeatureFlagsService(store, clock);
		await service.setStoreOverride(ACTOR, "till-redemption", { tenantId: MERCHANT, locationId: null, enabled: true, reason: "Every Jonker branch" });
		await expect(service.removeStoreOverride(ACTOR, "till-redemption", OVERRIDE_ID)).resolves.toBeUndefined();
		await expect(service.removeStoreOverride(ACTOR, "till-redemption", OVERRIDE_ID)).rejects.toThrow(FeatureFlagOverrideNotFoundError);
	});

	it("searches stores by name, all of them when nothing is typed, capped", async () => {
		const store = new FakeStore([]);
		const service = new FeatureFlagsService(store, clock);
		await expect(service.searchStores(ACTOR, "jonker")).resolves.toMatchObject({ stores: [{ tenantName: "Jonker Street Kitchen" }] });
		await service.searchStores(ACTOR, undefined);
		expect(store.searched).toStrictEqual([
			{ search: "jonker", limit: FEATURE_FLAG_STORE_SEARCH_LIMIT },
			{ search: "", limit: FEATURE_FLAG_STORE_SEARCH_LIMIT },
		]);
	});
});
