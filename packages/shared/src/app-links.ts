// ============================================
// app-links.ts - frontend paths that cross an app boundary
// ============================================
// Each frontend app owns its routes in its own `lib/routes.ts`. The paths
// below are the exceptions: another process builds URLs to them — the API
// puts them in emails and invite links — so they live here, once, and the
// apps' route modules use these same constants for them. Rename a page in an
// app and its `lib/routes.ts` + this file change together (docs/technical/frontend/routing.md).

import { listFilterKey } from "./schemas/api/list-query";
import { MfaRecoveryRecordStatusSchema } from "./schemas/auth/mfa-recovery";

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
	/** Signed-in browse (the `/rewardhub` shell). */
	readonly rewardHub: string;
	/** The signed-in user's claimed rewards. */
	readonly wallet: string;
	/** Personal account — profile, password, 2FA, sessions. */
	readonly account: string;
}

/** Merchant app pages the API links to. */
export interface MerchantAppLinks {
	/** Invite-token onboarding for a new merchant (`?token=`). */
	readonly onboarding: string;
	/** Invite-token team invitation (`?token=`). */
	readonly teamInvite: string;
	/** An organization's API keys. */
	readonly apiKeys: (organizationSlug: string) => string;
	readonly terminals: (organizationSlug: string) => string;
}

/** Admin app pages the API links to. */
export interface AdminAppLinks {
	readonly home: string;
	/** The MFA-recovery request queue (super-admin), every status. */
	readonly mfaRecoveryQueue: string;
	/** The same queue filtered to requests awaiting review (`filter[status]=PENDING`) — what review-request emails link to. */
	readonly mfaRecoveryPendingQueue: string;
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
		rewardHub: "/rewardhub",
		wallet: "/rewardhub/wallet",
		account: "/rewardhub/account",
	},
	merchant: {
		onboarding: "/onboarding",
		teamInvite: "/team-invite",
		apiKeys: (organizationSlug: string): string => `/orgs/${encodeURIComponent(organizationSlug)}/api-keys`,
		terminals: (organizationSlug: string): string => `/orgs/${encodeURIComponent(organizationSlug)}/terminals`,
	},
	admin: {
		home: "/",
		mfaRecoveryQueue: ADMIN_MFA_RECOVERY_QUEUE_PATH,
		mfaRecoveryPendingQueue: withListQuery(ADMIN_MFA_RECOVERY_QUEUE_PATH, { [listFilterKey("status")]: MfaRecoveryRecordStatusSchema.enum.PENDING }),
	},
};
