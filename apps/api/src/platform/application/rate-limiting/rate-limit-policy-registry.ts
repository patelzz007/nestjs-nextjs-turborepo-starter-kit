// ============================================
// platform/application/rate-limiting/rate-limit-policy-registry.ts — every named limit, in one list (ADR 071)
// ============================================
// Each module registers the policies it counts (at init), so the admin Rate limits page lists every limit
// the API applies without the platform knowing the contexts. The names are the ones the limiter keys and
// the refusal log use: SCREAMING_SNAKE, one per policy.

import { Injectable } from "@nestjs/common";
import type { RateLimitAlgorithm, RateLimitSubjectKind } from "@workspace/shared";

import type { RateLimitFailMode } from "../ports/rate-limiter.port";

export interface RateLimitPolicyDescriptor {
	readonly name: string;
	readonly algorithm: RateLimitAlgorithm;
	readonly subject: RateLimitSubjectKind;
	/** The limit as people read it: "5 per 1 min", "50/s, burst 200". */
	readonly limit: string;
	readonly failMode: RateLimitFailMode;
	/** Whether repeated refusals escalate into a penalty. */
	readonly penalty: boolean;
}

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** "1 min", "1 h", "1 day", "30 s": the largest whole unit of a window. */
export function describeWindow(windowMs: number): string {
	const seconds = windowMs / MS_PER_SECOND;
	const minutes = seconds / SECONDS_PER_MINUTE;
	const hours = minutes / MINUTES_PER_HOUR;
	const days = hours / HOURS_PER_DAY;
	if (Number.isInteger(days)) {
		return `${String(days)} day${days === 1 ? "" : "s"}`;
	}
	if (Number.isInteger(hours)) {
		return `${String(hours)} h`;
	}
	if (Number.isInteger(minutes)) {
		return `${String(minutes)} min`;
	}
	return `${String(Math.round(seconds))} s`;
}

/** "5 per 1 min". */
export function describeSlidingWindow(limit: number, windowMs: number): string {
	return `${String(limit)} per ${describeWindow(windowMs)}`;
}

/** "50/s, burst 200". */
export function describeTokenBucket(ratePerSecond: number, burst: number): string {
	return `${String(ratePerSecond)}/s, burst ${String(burst)}`;
}

/** Thrown when two modules claim the same policy name: names key the limiter and must stay unique. */
export class DuplicateRateLimitPolicyError extends Error {
	public constructor(name: string) {
		super(`Rate-limit policy "${name}" is registered twice`);
		this.name = "DuplicateRateLimitPolicyError";
	}
}

@Injectable()
export class RateLimitPolicyRegistry {
	private readonly policies = new Map<string, RateLimitPolicyDescriptor>();

	public register(...descriptors: readonly RateLimitPolicyDescriptor[]): void {
		for (const descriptor of descriptors) {
			if (this.policies.has(descriptor.name)) {
				throw new DuplicateRateLimitPolicyError(descriptor.name);
			}
			this.policies.set(descriptor.name, descriptor);
		}
	}

	/** Every registered policy, by name. */
	public all(): readonly RateLimitPolicyDescriptor[] {
		return [...this.policies.values()].sort((left, right): number => left.name.localeCompare(right.name));
	}
}
