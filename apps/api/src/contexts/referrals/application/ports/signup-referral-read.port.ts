import type { EpochMs, PaginatedServiceResult, SignupReferralRefereeItem, SignupReferralRefereeListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SignupReferralSummary } from "./signup-referral.port";
import type { SignupReferralCodeForValidation } from "../../domain/policies/signup-referral-code-validity.policy";

/** What the referrer dashboard is decided from: the latest live code and the owner's account state. */
export interface SignupReferralDashboardFacts {
	readonly latestCode: { readonly code: string; readonly expiresAt: EpochMs } | null;
	/** `null` when the account row is gone. */
	readonly account: { readonly isDeleted: boolean; readonly isActive: boolean } | null;
}

/** Reads outside any write transaction (the dashboard, the referee list, code validation before signup). */
export interface SignupReferralReadPort {
	dashboardFacts(actor: ActorContext, userId: string): Promise<SignupReferralDashboardFacts>;
	/** The referrer's referees, each with the display name the referee registered with (one batched read for the page). */
	listReferees(actor: ActorContext, referrerUserId: string, query: SignupReferralRefereeListQuery): Promise<PaginatedServiceResult<SignupReferralRefereeItem>>;
	/** The code row matching `canonical`, with its owner's state and latest code id, in one read. */
	findCodeForValidation(canonical: string): Promise<SignupReferralCodeForValidation | null>;
	/** Referee id → referrer and status, in one batched read (admin user list). */
	summariesForReferees(refereeUserIds: readonly string[]): Promise<ReadonlyMap<string, SignupReferralSummary>>;
}
