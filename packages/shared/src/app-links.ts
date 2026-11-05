// ============================================
// app-links.ts - frontend paths that cross an app boundary
// ============================================
// Each frontend app owns its routes in its own `lib/routes.ts`. The paths
// below are the exceptions: another process builds URLs to them — the API
// puts them in emails and invite links — so they live here, once, and the
// apps' route modules use these same constants for them. Rename a page in an
// app and its `lib/routes.ts` + this file change together (docs/technical/frontend/routing.md).

import { listFilterKey } from "./schemas/api/list-query";
import { MfaRecoveryRecordStatusSchema } from "./contexts/identity/schemas/mfa-recovery";

/** The admin MFA-recovery queue page (all statuses). */
const ADMIN_MFA_RECOVERY_QUEUE_PATH = "/users/mfa-recovery";

/**
 * `path?query` with the query built by `URLSearchParams` from list-grammar
 * keys ({@link listFilterKey}) — never a hand-written query string.
 */
function withListQuery(path: string, params: Readonly<Record<string, string>>): string {
	return `${path}?${new URLSearchParams(params).toString()}`;
}

/** Auth pages every app with that flow serves at the same path. */
export interface AuthAppLinks {
	readonly login: string;
	readonly verifyEmail: string;
	readonly resetPassword: string;
	readonly forgotPassword: string;
}

/** Consumer web app pages the API links to. */
export interface WebAppLinks {
	readonly home: string;
	/** Signed-in browse (the `/dashboard` shell). */
	readonly dashboard: string;
	/** The signed-in user's claimed rewards. */
	readonly wallet: string;
	/** Personal account — profile, password, 2FA, sessions. */
	readonly account: string;
	/** The customer inbox (ADR 070). */
	readonly notifications: string;
	/** A reward's signed-in page, where it is claimed. */
	readonly reward: (rewardId: string) => string;
	/** The unsubscribe page an email's footer links (`?token=`; no sign-in needed). */
	readonly unsubscribe: string;
	/** The public status page (enhancement 4.5; no sign-in needed). */
	readonly status: string;
}

/** Merchant app pages the API links to. */
export interface MerchantAppLinks {
	/** Invite-token onboarding for a new merchant (`?token=`). */
	readonly onboarding: string;
	/** Invite-token team invitation (`?token=`). */
	readonly teamInvite: string;
	/** A tenant's API keys. */
	readonly apiKeys: (tenantSlug: string) => string;
	readonly terminals: (tenantSlug: string) => string;
	/** A tenant's outgoing webhooks, and one endpoint with its delivery log (ADR 082). */
	readonly webhooks: (tenantSlug: string) => string;
	readonly webhookEndpoint: (tenantSlug: string, endpointId: string) => string;
	/** One of a tenant's rewards, and its editor (reward-review notices link here, ADR 070). */
	readonly reward: (tenantSlug: string, rewardId: string) => string;
	readonly rewardEdit: (tenantSlug: string, rewardId: string) => string;
	/** The merchant inbox entry: resolves the member's tenant, then opens `/t/{slug}/notifications`. */
	readonly notifications: string;
}

/** Admin app pages the API links to. */
export interface AdminAppLinks {
	readonly home: string;
	/** The MFA-recovery request queue (super-admin), every status. */
	readonly mfaRecoveryQueue: string;
	/** The same queue filtered to requests awaiting review (`filter[status]=PENDING`) — what review-request emails link to. */
	readonly mfaRecoveryPendingQueue: string;
	/** The staff inbox (ADR 070). */
	readonly notifications: string;
}

export interface AppLinks {
	readonly auth: AuthAppLinks;
	readonly web: WebAppLinks;
	readonly merchant: MerchantAppLinks;
	readonly admin: AdminAppLinks;
}

/** Frontend paths built into URLs by another app (the API's emails and invite links). */
export const APP_LINKS: AppLinks = {
	auth: {
		login: "/auth/login",
		verifyEmail: "/auth/verify-email",
		resetPassword: "/auth/reset-password",
		forgotPassword: "/auth/forgot-password",
	},
	web: {
		home: "/",
		dashboard: "/dashboard",
		wallet: "/dashboard/wallet",
		account: "/dashboard/account",
		notifications: "/dashboard/notifications",
		reward: (rewardId: string): string => `/dashboard/rewards/${encodeURIComponent(rewardId)}`,
		unsubscribe: "/unsubscribe",
		status: "/status",
	},
	merchant: {
		onboarding: "/onboarding",
		teamInvite: "/team-invite",
		apiKeys: (tenantSlug: string): string => `/t/${encodeURIComponent(tenantSlug)}/api-keys`,
		terminals: (tenantSlug: string): string => `/t/${encodeURIComponent(tenantSlug)}/terminals`,
		webhooks: (tenantSlug: string): string => `/t/${encodeURIComponent(tenantSlug)}/webhooks`,
		webhookEndpoint: (tenantSlug: string, endpointId: string): string => `/t/${encodeURIComponent(tenantSlug)}/webhooks/${encodeURIComponent(endpointId)}`,
		reward: (tenantSlug: string, rewardId: string): string => `/t/${encodeURIComponent(tenantSlug)}/rewards/${encodeURIComponent(rewardId)}`,
		rewardEdit: (tenantSlug: string, rewardId: string): string => `/t/${encodeURIComponent(tenantSlug)}/rewards/${encodeURIComponent(rewardId)}/edit`,
		notifications: "/notifications",
	},
	admin: {
		home: "/",
		mfaRecoveryQueue: ADMIN_MFA_RECOVERY_QUEUE_PATH,
		mfaRecoveryPendingQueue: withListQuery(ADMIN_MFA_RECOVERY_QUEUE_PATH, { [listFilterKey("status")]: MfaRecoveryRecordStatusSchema.enum.PENDING }),
		notifications: "/notifications",
	},
};
