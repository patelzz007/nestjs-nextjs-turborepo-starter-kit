// ============================================
// platform/application/ports/rate-limit-insights.port.ts — what the admin Rate limits page reads (ADR 071)
// ============================================

import type { RateLimitSubject, RateLimitSubjectKind } from "./rate-limiter.port";

/** One refusal from the capped log: masked, with an opaque reference to lift its penalty. */
export interface RecordedRateLimitRefusal {
	readonly policyName: string;
	readonly subjectKind: RateLimitSubjectKind;
	readonly maskedSubject: string;
	readonly subjectRef: string;
	readonly penalized: boolean;
	readonly atEpochMs: number;
}

export interface RateLimitRefusalsPort {
	/** The newest refusals since `sinceEpochMs`, newest first, at most `limit`. */
	recent(sinceEpochMs: number, limit: number): Promise<RecordedRateLimitRefusal[]>;
	/** The policy and subject a reference names, while it lasts; null once gone. */
	resolveSubject(subjectRef: string): Promise<{ readonly policyName: string; readonly subject: RateLimitSubject } | null>;
}

/** Traffic counted but never refused, as the admin page lists it. */
export interface RateLimitExemptionEntry {
	readonly kind: "load-test" | "cidr";
	readonly label: string;
}

export interface RateLimitExemptionListPort {
	list(): readonly RateLimitExemptionEntry[];
}

export const RATE_LIMIT_REFUSALS = Symbol("RATE_LIMIT_REFUSALS");
export const RATE_LIMIT_EXEMPTION_LIST = Symbol("RATE_LIMIT_EXEMPTION_LIST");
