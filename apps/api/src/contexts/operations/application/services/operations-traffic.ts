// ============================================
// operations/application/services/operations-traffic.ts — the Rate limits and Cache pages (ADR 071, 072)
// ============================================
// Reads the policy registry, the capped refusal log and the cache's own counters; sets tenant overrides,
// lifts penalties and flushes caches. Nothing here shows an address or id: subjects stay masked and a
// penalty is lifted through the refusal's opaque reference.

import {
	epochMs,
	OPS_HOUR_MS,
	type CacheOverview,
	type FlushCacheInput,
	type LiftRateLimitPenaltyInput,
	type RateLimitedSubject,
	type RateLimitPolicySummary,
	type RateLimitsOverview,
	type SetTenantRateLimitOverrideInput,
	type TenantRateLimitOverride,
} from "@workspace/shared";

import type { Clock } from "../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { REQUIRED_REDIS_MEMORY_POLICY, type AppCache, type CacheNamespaceStats } from "../../../../platform/application/ports/app-cache.port";
import type { RateLimitExemptionListPort, RateLimitRefusalsPort, RecordedRateLimitRefusal } from "../../../../platform/application/ports/rate-limit-insights.port";
import type { RateLimiter } from "../../../../platform/application/ports/rate-limiter.port";
import type { TenantRateLimitOverridesPort } from "../../../../platform/application/ports/tenant-rate-limit-overrides.port";
import type { RateLimitPolicyDescriptor, RateLimitPolicyRegistry } from "../../../../platform/application/rate-limiting/rate-limit-policy-registry";

/** The page covers the last hour, in 10-minute buckets (oldest first). */
const OVERVIEW_WINDOW_MS = OPS_HOUR_MS;
const BUCKETS = 6;
const BUCKET_MS = OVERVIEW_WINDOW_MS / BUCKETS;
/** Refusals read per overview: the whole capped stream at most. */
const REFUSALS_READ = 10_000;
/** Rows of "top limited subjects". */
const TOP_SUBJECTS = 20;

export interface OperationsTrafficDependencies {
	readonly clock: Clock;
	readonly policies: RateLimitPolicyRegistry;
	readonly refusals: RateLimitRefusalsPort;
	readonly exemptions: RateLimitExemptionListPort;
	readonly overrides: TenantRateLimitOverridesPort;
	readonly limiter: RateLimiter;
	readonly cache: AppCache;
	/** Percent of Redis maxmemory at which the cache reports itself degraded. */
	readonly cacheAlertPercent: number;
}

/** "Lift penalty" names a refusal that is gone (references last a day). */
export class RateLimitSubjectGoneError extends NotFoundError {
	public constructor() {
		super({ message: "That subject is no longer in the refusal log; its penalty has expired" });
	}
}

export class OperationsTrafficService {
	public constructor(private readonly deps: OperationsTrafficDependencies) {}

	public async rateLimits(): Promise<RateLimitsOverview> {
		const now = this.deps.clock.now();
		const since = now - OVERVIEW_WINDOW_MS;
		const refusals = await this.deps.refusals.recent(since, REFUSALS_READ);
		return {
			policies: this.deps.policies.all().map((policy: RateLimitPolicyDescriptor): RateLimitPolicySummary => policySummary(policy, refusals, since)),
			topSubjects: topSubjects(refusals),
			exemptions: [...this.deps.exemptions.list()],
		};
	}

	public overrides(actorUserId: string): Promise<readonly TenantRateLimitOverride[]> {
		return this.deps.overrides.list(actorUserId);
	}

	public setOverride(input: SetTenantRateLimitOverrideInput, actorUserId: string): Promise<TenantRateLimitOverride> {
		return this.deps.overrides.set(input, actorUserId);
	}

	public async removeOverride(overrideId: string, actorUserId: string): Promise<void> {
		if (!(await this.deps.overrides.remove(overrideId, actorUserId))) {
			throw new NotFoundError({ message: "Override not found" });
		}
	}

	public async liftPenalty(input: LiftRateLimitPenaltyInput): Promise<void> {
		const referenced = await this.deps.refusals.resolveSubject(input.subjectRef);
		if (referenced === null) {
			throw new RateLimitSubjectGoneError();
		}
		await this.deps.limiter.liftPenalty(referenced.policyName, referenced.subject);
	}

	public async cache(): Promise<CacheOverview> {
		const [stats, memory] = await Promise.all([this.deps.cache.stats(), this.deps.cache.memory()]);
		return {
			namespaces: stats.map((namespace: CacheNamespaceStats) => {
				const reads = namespace.counters.hits + namespace.counters.misses;
				return {
					name: namespace.name,
					version: namespace.version,
					tier: namespace.tier,
					scope: namespace.scope,
					encrypted: namespace.encrypted,
					ttlMs: namespace.ttlMs,
					localEntries: namespace.localEntries,
					sharedKeys: namespace.sharedKeys,
					sharedMaxKeys: namespace.sharedMaxKeys,
					hits: namespace.counters.hits,
					misses: namespace.counters.misses,
					staleServed: namespace.counters.staleServed,
					loadFailures: namespace.counters.loadFailures,
					refusedWrites: namespace.counters.refusedWrites,
					hitRatio: reads === 0 ? null : namespace.counters.hits / reads,
				};
			}),
			redis:
				memory === null
					? null
					: {
							usedBytes: memory.usedBytes,
							maxBytes: memory.maxBytes,
							policy: memory.policy,
							alertPercent: this.deps.cacheAlertPercent,
							policyOk: memory.policy === REQUIRED_REDIS_MEMORY_POLICY,
						},
			circuitOpen: this.deps.cache.isCircuitOpen(),
		};
	}

	public async flushCache(input: FlushCacheInput): Promise<void> {
		if (input.target === "namespace") {
			const known = (await this.deps.cache.stats()).some((namespace: CacheNamespaceStats): boolean => namespace.name === input.name);
			if (!known) {
				throw new NotFoundError({ message: `No cache named "${input.name}"` });
			}
			await this.deps.cache.flushNamespace(input.name);
			return;
		}
		await this.deps.cache.flushTenant(input.tenantId);
	}
}

function policySummary(policy: RateLimitPolicyDescriptor, refusals: readonly RecordedRateLimitRefusal[], since: number): RateLimitPolicySummary {
	const own = refusals.filter((refusal: RecordedRateLimitRefusal): boolean => refusal.policyName === policy.name);
	const buckets = Array.from({ length: BUCKETS }, (): number => 0);
	for (const refusal of own) {
		const index = Math.min(BUCKETS - 1, Math.max(0, Math.floor((refusal.atEpochMs - since) / BUCKET_MS)));
		buckets.splice(index, 1, (buckets.at(index) ?? 0) + 1);
	}
	return {
		name: policy.name,
		algorithm: policy.algorithm,
		subject: policy.subject,
		limit: policy.limit,
		failMode: policy.failMode,
		penalty: policy.penalty,
		refusedLastHour: own.length,
		refusalsByTenMinutes: buckets,
	};
}

/** The subjects refused most often over the hour, one row per policy and subject. */
function topSubjects(refusals: readonly RecordedRateLimitRefusal[]): RateLimitedSubject[] {
	const rows = new Map<string, RateLimitedSubject>();
	// Newest first: the first entry of a row sets its last refusal time.
	for (const refusal of refusals) {
		const existing = rows.get(refusal.subjectRef);
		rows.set(
			refusal.subjectRef,
			existing === undefined
				? {
						policyName: refusal.policyName,
						subjectKind: refusal.subjectKind,
						maskedSubject: refusal.maskedSubject,
						subjectRef: refusal.subjectRef,
						refusals: 1,
						penalized: refusal.penalized,
						lastRefusedAt: epochMs(refusal.atEpochMs),
					}
				: { ...existing, refusals: existing.refusals + 1, penalized: existing.penalized || refusal.penalized },
		);
	}
	return [...rows.values()].sort((left, right): number => right.refusals - left.refusals).slice(0, TOP_SUBJECTS);
}
