import {
	FEATURE_FLAG_REGISTRY,
	FEATURE_FLAG_STORE_SEARCH_LIMIT,
	FeatureFlagKeySchema,
	type FeatureFlag,
	type FeatureFlagKey,
	type FeatureFlagList,
	type FeatureFlagSettings,
	type FeatureFlagStoreOptionList,
	type FeatureFlagStoreOverride,
	type FeatureFlagStoreOverrideList,
	type SetFeatureFlagStoreOverrideInput,
	type StoreFeatureFlagKey,
	type UpdateFeatureFlagInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { FeatureFlagOverrideNotFoundError, FeatureFlagStoreNotFoundError } from "../../domain/errors/feature-flag.errors";
import type { FeatureFlagRecord, FeatureFlagStore } from "../ports/feature-flag.store";

function toFlag(key: FeatureFlagKey, record: FeatureFlagRecord | undefined): FeatureFlag {
	const entry = FEATURE_FLAG_REGISTRY[key];
	return {
		key,
		scope: entry.scope,
		title: entry.title,
		description: entry.description,
		defaultFrom: entry.defaultFrom,
		mode: record?.mode ?? "DEFAULT",
		percentage: record?.percentage ?? null,
		reason: record?.reason ?? null,
		updatedAt: record?.updatedAt ?? null,
		updatedByName: record?.updatedByName ?? null,
	};
}

/**
 * Runtime feature flags (enhancements 5.6, 5.11): every flag the code declares, each with its stored setting or
 * DEFAULT, and a store flag's per-store settings. The apps read the settings and evaluate them themselves (`evaluateFeatureFlag`), because a flag's
 * default is a fact of that app's deployment.
 */
export class FeatureFlagsService {
	public constructor(
		private readonly store: FeatureFlagStore,
		private readonly clock: Clock,
	) {}

	public async list(actor: ActorContext): Promise<FeatureFlagList> {
		const records = new Map((await this.store.settings(actor, true)).map((record): [FeatureFlagKey, FeatureFlagRecord] => [record.key, record]));
		return { flags: FeatureFlagKeySchema.options.map((key) => toFlag(key, records.get(key))) };
	}

	public async settings(actor: ActorContext): Promise<FeatureFlagSettings> {
		const records = new Map((await this.store.settings(actor, false)).map((record): [FeatureFlagKey, FeatureFlagRecord] => [record.key, record]));
		return {
			settings: FeatureFlagKeySchema.options.map((key) => {
				const record = records.get(key);
				return { key, mode: record?.mode ?? "DEFAULT", percentage: record?.percentage ?? null };
			}),
		};
	}

	public async update(actor: ActorContext, key: FeatureFlagKey, input: UpdateFeatureFlagInput): Promise<FeatureFlag> {
		return toFlag(key, await this.store.save(actor, key, { mode: input.mode, percentage: input.percentage, reason: input.reason, at: this.clock.now() }));
	}

	/** A store flag's per-store settings (enhancement 5.11). */
	public async storeOverrides(actor: ActorContext, key: StoreFeatureFlagKey): Promise<FeatureFlagStoreOverrideList> {
		return { overrides: [...(await this.store.storeOverrides(actor, key))] };
	}

	/** Sets a merchant's or a branch's own value of a store flag, with why; the branch must be the merchant's. */
	public async setStoreOverride(actor: ActorContext, key: StoreFeatureFlagKey, input: SetFeatureFlagStoreOverrideInput): Promise<FeatureFlagStoreOverride> {
		const saved = await this.store.setStoreOverride(actor, key, {
			tenantId: input.tenantId,
			locationId: input.locationId,
			enabled: input.enabled,
			reason: input.reason,
			at: this.clock.now(),
		});
		if (saved === null) {
			throw new FeatureFlagStoreNotFoundError(input.tenantId, input.locationId);
		}
		return saved;
	}

	/** The stores a store flag can be set for, by name (the console's store picker). */
	public async searchStores(actor: ActorContext, search: string | undefined): Promise<FeatureFlagStoreOptionList> {
		return { stores: [...(await this.store.searchStores(actor, search ?? "", FEATURE_FLAG_STORE_SEARCH_LIMIT))] };
	}

	/** Removes a store's own setting: it follows the deployment's again. The reason goes to the request audit. */
	public async removeStoreOverride(actor: ActorContext, key: StoreFeatureFlagKey, overrideId: string): Promise<void> {
		if (!(await this.store.removeStoreOverride(actor, key, overrideId, this.clock.now()))) {
			throw new FeatureFlagOverrideNotFoundError(overrideId);
		}
	}
}
