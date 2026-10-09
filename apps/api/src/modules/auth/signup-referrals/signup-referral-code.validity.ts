import type { SignupReferralCodeRejection } from "./signup-referral.errors";

/** One code row with exactly what the validity rule reads (ADR 035, "Validity"). */
export interface SignupReferralCodeForValidation {
	readonly id: string;
	readonly userId: string;
	readonly expiresAt: bigint;
	readonly isDeleted: boolean;
	readonly owner: {
		readonly isDeleted: boolean;
		readonly isActive: boolean;
		/** The owner's latest code (greatest `createdAt`, tie broken by `id`), or null when none is live. */
		readonly latestCodeId: string | null;
	};
}

export type SignupReferralCodeValidity =
	| { readonly kind: "valid"; readonly referrerUserId: string; readonly referralCodeId: string }
	| { readonly kind: "rejected"; readonly rejection: SignupReferralCodeRejection };

/**
 * The validity rule, in the ADR's order: unknown → unrecognized; not the
 * owner's latest row, or `now >= expiresAt` → expired; owner soft-deleted or
 * deactivated → unavailable. A temporary lock (`lockedUntil`) never fails it.
 */
export function evaluateSignupReferralCode(row: SignupReferralCodeForValidation | null, now: number): SignupReferralCodeValidity {
	if (row === null || row.isDeleted) {
		return { kind: "rejected", rejection: "unrecognized" };
	}
	if (row.owner.latestCodeId !== row.id || now >= Number(row.expiresAt)) {
		return { kind: "rejected", rejection: "expired" };
	}
	if (row.owner.isDeleted || !row.owner.isActive) {
		return { kind: "rejected", rejection: "unavailable" };
	}
	return { kind: "valid", referrerUserId: row.userId, referralCodeId: row.id };
}
