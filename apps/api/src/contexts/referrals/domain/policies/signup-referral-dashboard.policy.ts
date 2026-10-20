import type { EpochMs, SignupReferralDashboard } from "@workspace/shared";

/** What the dashboard is decided from. */
export interface SignupReferralDashboardInput {
	readonly latestCode: { readonly code: string; readonly expiresAt: EpochMs } | null;
	readonly account: { readonly isDeleted: boolean; readonly isActive: boolean } | null;
}

/**
 * The caller's latest code and its state (ADR 035, "Consumer read"). An account the job has not
 * backfilled yet is `pending`; an expired latest code is `expired`; a deleted or deactivated owner
 * is `unavailable`. Only an `active` code is shareable.
 */
export function signupReferralDashboardOf(input: SignupReferralDashboardInput, now: number): SignupReferralDashboard {
	const { latestCode, account } = input;
	if (latestCode === null) {
		return { code: null, expiresAt: null, shareable: false, codeState: "pending" };
	}
	if (now >= latestCode.expiresAt) {
		return { code: latestCode.code, expiresAt: latestCode.expiresAt, shareable: false, codeState: "expired" };
	}
	if (account === null || account.isDeleted || !account.isActive) {
		return { code: latestCode.code, expiresAt: latestCode.expiresAt, shareable: false, codeState: "unavailable" };
	}
	return { code: latestCode.code, expiresAt: latestCode.expiresAt, shareable: true, codeState: "active" };
}

/** A user's latest code as the code job re-reads it under the user's lock. */
export interface SignupReferralCodeMaintenanceState {
	readonly isDeleted: boolean;
	readonly latestExpiresAt: number | null;
}

/** Whether the job issues a code: the user is live and has no code, or its latest code expired. */
export function isSignupReferralCodeDue(state: SignupReferralCodeMaintenanceState | null, now: number): state is SignupReferralCodeMaintenanceState {
	return state !== null && !state.isDeleted && (state.latestExpiresAt === null || now >= state.latestExpiresAt);
}
