import "server-only";

import type { FeatureFlagBundle, FeatureFlagKey } from "@workspace/shared";
import { cache } from "react";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { enabledAdminFeatureFlags } from "@/lib/feature-flags";
import { loadMerchantInvitingOffered } from "@/lib/server/merchant-invite-availability";
import { prefetch, type PrefetchFailureLogger } from "@/lib/server/prefetch";

const logFailuresOnly: PrefetchFailureLogger = (level, message): void => {
	if (level === "error") {
		console.error(message);
	}
};

/**
 * The admin app's feature flag bundle for this request's staff member (ADR 087), asked once per request: the API's
 * evaluated values. Null when the API couldn't answer: every flag then reads as its code default.
 */
export const loadFeatureFlagBundle = cache(async (): Promise<FeatureFlagBundle | null> => {
	const result = await prefetch(
		{ page: "(panel)", resource: "feature flag bundle" },
		() => createAdminServerCaller().featureFlags.bundle.query({ app: "admin" }),
		logFailuresOnly,
	);
	return result.status === "ok" ? result.data.data : null;
});

/**
 * The flags on for this request's staff member: one answer per request, shared by the sidebar, the home page and
 * the flagged routes, so a menu item and its page never disagree.
 */
export const loadEnabledFeatureFlags = cache(async (): Promise<readonly FeatureFlagKey[]> => {
	const [bundle, merchantInvitesOffered] = await Promise.all([loadFeatureFlagBundle(), loadMerchantInvitingOffered()]);
	return enabledAdminFeatureFlags(bundle, { merchantInvitesOffered });
});

/** Whether one flag is on for this request's staff member. */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
	return (await loadEnabledFeatureFlags()).includes(key);
}
