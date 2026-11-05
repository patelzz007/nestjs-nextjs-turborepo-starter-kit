import "server-only";

import type { FeatureFlagKey, FeatureFlagSetting } from "@workspace/shared";
import { cache } from "react";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { loadAdminServerSession } from "@/lib/auth-server";
import { serverEnv } from "@/lib/env/env.server";
import { resolveEnabledFeatureFlags } from "@/lib/feature-flags";
import { loadMerchantInvitingOffered } from "@/lib/server/merchant-invite-availability";
import { prefetch, type PrefetchFailureLogger } from "@/lib/server/prefetch";

const logFailuresOnly: PrefetchFailureLogger = (level, message): void => {
	if (level === "error") {
		console.error(message);
	}
};

/**
 * The feature flags' stored settings (enhancement 5.6), asked once per request. When the API can't answer, no
 * setting applies and every flag keeps its default: a flag never turns something on because a read failed.
 */
export const loadFeatureFlagSettings = cache(async (): Promise<readonly FeatureFlagSetting[]> => {
	const result = await prefetch(
		{ page: "(panel)", resource: "feature flag settings" },
		() => createAdminServerCaller().featureFlags.settings.query(undefined),
		logFailuresOnly,
	);
	return result.status === "ok" ? result.data.data.settings : [];
});

/**
 * The flags on for this request's staff member (enhancement 5.6): the deployment defaults with the runtime
 * settings applied. One answer per request, shared by the sidebar, the home page and the flagged routes, so a
 * menu item and its page never disagree.
 */
export const loadEnabledFeatureFlags = cache(async (): Promise<readonly string[]> => {
	// The person comes from the API-verified session (never the undecoded token), so a rollout can't be steered.
	const [session, merchantInvitesOffered, settings] = await Promise.all([loadAdminServerSession(), loadMerchantInvitingOffered(), loadFeatureFlagSettings()]);
	const subjectId = session.kind === "signed-in" ? session.session.profile.data.id : null;
	return resolveEnabledFeatureFlags(serverEnv, { merchantInvitesOffered }, { settings, subjectId });
});

/** Whether one flag is on for this request's staff member. */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
	return (await loadEnabledFeatureFlags()).includes(key);
}
