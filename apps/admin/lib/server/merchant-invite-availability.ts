import "server-only";

import type { AdminMerchantInviteAvailability, Envelope } from "@workspace/shared";
import { cache } from "react";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, type PrefetchFailureLogger, type PrefetchResult } from "@/lib/server/prefetch";

/**
 * Whether the invite page is offered. Only the API's own "no" (a single-tenant deployment, which
 * serves its one seeded tenant) hides it: an admin without the permission is already kept out by the
 * menu's permission rule, and an unreachable API leaves the decision to `POST /admin/invites`, which
 * refuses on its own (403 TENANT_PROVISIONING_DISABLED).
 */
export function isMerchantInvitingOffered(result: PrefetchResult<Envelope<AdminMerchantInviteAvailability>>): boolean {
	return result.status !== "ok" || result.data.data.available;
}

/** Logs a real failure; a 401/403 is expected here (an admin who may not invite) and stays quiet. */
const logFailuresOnly: PrefetchFailureLogger = (level, message): void => {
	if (level === "error") {
		console.error(message);
	}
};

/** Asked once per request (`React.cache`): the panel layout's sidebar flag and the invite page share the answer. */
export const loadMerchantInvitingOffered = cache(async (): Promise<boolean> => {
	const result = await prefetch(
		{ page: "(panel)", resource: "merchant invite availability" },
		() => createAdminServerCaller().rewardsAdmin.inviteAvailability.query(undefined),
		logFailuresOnly,
	);
	return isMerchantInvitingOffered(result);
});
