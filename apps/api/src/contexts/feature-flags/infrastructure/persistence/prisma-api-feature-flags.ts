import { API_FEATURE_FLAG_DEFAULTS, evaluateFeatureFlag, FeatureFlagModeSchema, type ApiFeatureFlagKey } from "@workspace/shared";

import type { ApiFeatureFlags } from "../../application/ports/api-feature-flags.port";
import { FEATURE_FLAGS_EVALUATE_OPERATION as EVALUATE_OPERATION } from "../../application/ports/feature-flags.operations";
import type { FeatureFlagTransactions } from "./prisma-feature-flag.store";

/** `ApiFeatureFlags` over Prisma: one small read per question, no cache (a change applies at once). */
export class PrismaApiFeatureFlags implements ApiFeatureFlags {
	public constructor(private readonly transactions: FeatureFlagTransactions) {}

	public isOn(key: ApiFeatureFlagKey): Promise<boolean> {
		return this.transactions.withSystemOperation({ operation: EVALUATE_OPERATION, reason: `Feature flags: is ${key} on`, actorUserId: null }, async (tx) => {
			const setting = await tx.featureFlagSetting.findFirst({ where: { key, isDeleted: false }, select: { mode: true, percentage: true } });
			const stored = setting === null ? undefined : { mode: FeatureFlagModeSchema.parse(setting.mode), percentage: setting.percentage };
			// No person: the API decides for everyone at once, so a percentage rollout reads as off.
			return evaluateFeatureFlag(key, stored, API_FEATURE_FLAG_DEFAULTS[key], null);
		});
	}
}
