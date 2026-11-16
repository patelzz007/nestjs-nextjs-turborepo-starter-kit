import { defineStateMachine, type StateMachine } from "../../../lib/state-machine";
import { KybStatusSchema, type KybStatus } from "./tenant-enums";

/** The named moves of a merchant's KYB review. */
export type KybReviewEvent = "submit" | "applyOnboarding" | "flagEvidence" | "clearEvidence" | "approve" | "reject" | "requestAction";

/** The moves a platform admin makes (`PATCH /admin/merchants/:id/kyb`); the rest are the merchant's or the scanner's. */
export type KybAdminDecisionEvent = Extract<KybReviewEvent, "approve" | "reject" | "requestAction">;

const KYB_ADMIN_DECISION_EVENTS: readonly KybAdminDecisionEvent[] = ["approve", "reject", "requestAction"];

const EVERY_KYB_STATUS: readonly KybStatus[] = KybStatusSchema.options;

/**
 * A merchant's KYB review (docs/architecture/state-machines.md, migration plan D05 §7.5).
 *
 * - The merchant `submit`s (any status but APPROVED reopens the review as PENDING).
 * - Scan verdicts `flagEvidence` (infected/unscannable → ACTION_REQUIRED) or `clearEvidence`
 *   (all clean again → PENDING); a decided review (APPROVED/REJECTED) is never changed by a scan.
 * - A platform admin `approve`s, `reject`s or `requestAction`s. A rejected review never reopens by an
 *   admin decision — the merchant resubmits — and nothing is decided back to PENDING.
 *
 * `applyOnboarding` has no status guard in the aggregate today, so it starts from every status; it is
 * a tracked follow-up in the catalog. The API's `MerchantVerification` aggregate enforces this table;
 * the admin decision form offers only the decisions it allows.
 */
export const KYB_REVIEW: StateMachine<KybStatus, KybReviewEvent> = defineStateMachine({
	name: "KybReview",
	states: EVERY_KYB_STATUS,
	initial: ["PENDING"],
	terminal: [],
	transitions: {
		submit: { from: ["PENDING", "ACTION_REQUIRED", "REJECTED"], to: "PENDING" },
		applyOnboarding: { from: EVERY_KYB_STATUS, to: "PENDING" },
		flagEvidence: { from: ["PENDING", "ACTION_REQUIRED"], to: "ACTION_REQUIRED" },
		clearEvidence: { from: ["ACTION_REQUIRED"], to: "PENDING" },
		approve: { from: ["PENDING", "ACTION_REQUIRED"], to: "APPROVED" },
		reject: { from: ["PENDING", "ACTION_REQUIRED", "APPROVED"], to: "REJECTED" },
		requestAction: { from: ["PENDING", "APPROVED"], to: "ACTION_REQUIRED" },
	},
});

/** The admin decision that lands in `to` from `from`, or `null` when no admin decision may make that move. */
export function kybAdminDecisionFor(from: KybStatus, to: KybStatus): KybAdminDecisionEvent | null {
	return KYB_ADMIN_DECISION_EVENTS.find((event) => KYB_REVIEW.targetOf(event) === to && KYB_REVIEW.can(event, from)) ?? null;
}

/** The statuses an admin may decide a review in `from` into, in declaration order. */
export function kybAdminDecisionsFrom(from: KybStatus): readonly KybStatus[] {
	return KYB_ADMIN_DECISION_EVENTS.filter((event) => KYB_REVIEW.can(event, from)).map((event) => KYB_REVIEW.targetOf(event));
}
