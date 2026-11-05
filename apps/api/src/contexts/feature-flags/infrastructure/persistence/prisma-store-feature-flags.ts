import { evaluateStoreFeatureFlag, type StoreFeatureFlagKey, type StoreFlagTarget } from "@workspace/shared";

import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { StoreFeatureFlags } from "../../application/ports/store-feature-flags.port";
import type { FeatureFlagTransactions } from "./prisma-feature-flag.store";

/** Reads only the two flag tables (`feature_flags.evaluate`): a till's request learns nothing else. */
const EVALUATE_OPERATION: SystemOperationName = "feature_flags.evaluate";

/** `StoreFeatureFlags` over Prisma (enhancement 5.11): one small read per question, no cache (a change applies at once). */
export class PrismaStoreFeatureFlags implements StoreFeatureFlags {
	public constructor(private readonly transactions: FeatureFlagTransactions) {}

	public isOnAtStore(key: StoreFeatureFlagKey, store: StoreFlagTarget, subjectId: string | null): Promise<boolean> {
		return this.transactions.withSystemOperation({ operation: EVALUATE_OPERATION, reason: `Feature flags: is ${key} on at a store`, actorUserId: null }, async (tx) => {
			const [setting, overrides] = await Promise.all([
				tx.featureFlagSetting.findFirst({ where: { key, isDeleted: false }, select: { mode: true, percentage: true } }),
				tx.featureFlagStoreOverride.findMany({
					where: { key, tenantId: store.tenantId, isDeleted: false, OR: [{ locationId: null }, ...(store.locationId === null ? [] : [{ locationId: store.locationId }])] },
					select: { locationId: true, enabled: true },
				}),
			]);
			const merchant = overrides.find((row) => row.locationId === null)?.enabled ?? null;
			const branch = store.locationId === null ? null : (overrides.find((row) => row.locationId === store.locationId)?.enabled ?? null);
			return evaluateStoreFeatureFlag(key, { merchant, branch }, setting ?? undefined, subjectId);
		});
	}
}
