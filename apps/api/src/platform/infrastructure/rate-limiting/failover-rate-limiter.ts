// ============================================
// platform/infrastructure/rate-limiting/failover-rate-limiter.ts — the shared limiter with its local fallback
// ============================================
// Redis answers every decision. When it cannot (down, timing out), the policy's fail mode decides
// (ADR 071): `closed` counts locally with the full limit, refusing new subjects once the local store is
// full; `open` counts locally with the limit divided by the expected instance count, so N instances
// together stay near the shared limit.

import type { Logger } from "@nestjs/common";

import type {
	ConcurrencyDecision,
	ConcurrencyLease,
	ConcurrencyRequest,
	CountingRule,
	RateLimitDecision,
	RateLimiter,
	RateLimitRequest,
	RateLimitSubject,
} from "../../application/ports/rate-limiter.port";

/** A local share of a limit is never below one. */
const MIN_LOCAL_SHARE = 1;

/** The rule one instance enforces alone when the limit is shared by `instances`. */
export function localShareOf(rule: CountingRule, instances: number): CountingRule {
	if (rule.algorithm === "sliding-window") {
		return { ...rule, limit: Math.max(MIN_LOCAL_SHARE, Math.floor(rule.limit / instances)) };
	}
	return { ...rule, ratePerSecond: rule.ratePerSecond / instances, burst: Math.max(MIN_LOCAL_SHARE, Math.floor(rule.burst / instances)) };
}

function sharedStoreUnavailable(policyName: string): string {
	return `rate_limit.shared_store_unavailable policy=${policyName}; counting locally`;
}

export class FailoverRateLimiter implements RateLimiter {
	public constructor(
		private readonly shared: RateLimiter | null,
		private readonly local: RateLimiter,
		private readonly expectedInstances: number,
		private readonly logger: Logger,
	) {}

	public async consume(request: RateLimitRequest): Promise<RateLimitDecision> {
		if (this.shared !== null) {
			try {
				return await this.shared.consume(request);
			} catch (error) {
				this.logger.warn(sharedStoreUnavailable(request.policyName), error);
			}
		}
		if (this.shared === null || request.failMode === "closed") {
			return this.local.consume(request);
		}
		return this.local.consume({ ...request, rule: localShareOf(request.rule, this.expectedInstances) });
	}

	public async acquire(request: ConcurrencyRequest): Promise<ConcurrencyDecision> {
		if (this.shared !== null) {
			try {
				return await this.shared.acquire(request);
			} catch (error) {
				this.logger.warn(sharedStoreUnavailable(request.policyName), error);
			}
		}
		return this.local.acquire(request);
	}

	public async release(lease: ConcurrencyLease): Promise<void> {
		await this.local.release(lease);
		if (this.shared !== null) {
			try {
				await this.shared.release(lease);
			} catch (error) {
				this.logger.warn(sharedStoreUnavailable(lease.policyName), error);
			}
		}
	}

	public async liftPenalty(policyName: string, subject: RateLimitSubject): Promise<void> {
		await this.local.liftPenalty(policyName, subject);
		if (this.shared !== null) {
			await this.shared.liftPenalty(policyName, subject);
		}
	}
}
