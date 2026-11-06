import { epochMs, type SetTenantRateLimitOverrideInput, type TenantRateLimitOverride } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { localAppCache } from "../../../../../e2e/support/local-app-cache";
import { RecordingRateLimiter } from "../../../../../e2e/support/recording-rate-limiter";
import type { Clock } from "../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { defineCache, PLATFORM_SCOPE } from "../../../../platform/application/ports/app-cache.port";
import type {
	RateLimitExemptionEntry,
	RateLimitExemptionListPort,
	RateLimitRefusalsPort,
	RecordedRateLimitRefusal,
} from "../../../../platform/application/ports/rate-limit-insights.port";
import type { PenaltyRule, RateLimitRequest, RateLimitSubject } from "../../../../platform/application/ports/rate-limiter.port";
import type { TenantRateLimitOverridesPort } from "../../../../platform/application/ports/tenant-rate-limit-overrides.port";
import { RateLimitPolicyRegistry } from "../../../../platform/application/rate-limiting/rate-limit-policy-registry";
import { OperationsTrafficService, RateLimitSubjectGoneError } from "../services/operations-traffic";
import { z } from "zod";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const REF_A = "a".repeat(32);
const REF_B = "b".repeat(32);
const IP: RateLimitSubject = { kind: "ip", id: "203.0.113.42" };
/** A penalty after three refusals within an hour, for an hour (the shape of the security penalty). */
const PENALTY: PenaltyRule = { strikeThreshold: 3, strikeWindowMs: 60 * MINUTE, stepsMs: [60 * MINUTE], resetAfterMs: 24 * 60 * MINUTE };

class FixedClock implements Clock {
	public now(): ReturnType<Clock["now"]> {
		return epochMs(NOW);
	}
}

class FixedRefusals implements RateLimitRefusalsPort {
	public constructor(
		private readonly refusals: readonly RecordedRateLimitRefusal[],
		private readonly subjects: ReadonlyMap<string, { readonly policyName: string; readonly subject: RateLimitSubject }> = new Map(),
	) {}

	public recent(sinceEpochMs: number): Promise<RecordedRateLimitRefusal[]> {
		return Promise.resolve(this.refusals.filter((refusal) => refusal.atEpochMs >= sinceEpochMs));
	}

	public resolveSubject(subjectRef: string): Promise<{ readonly policyName: string; readonly subject: RateLimitSubject } | null> {
		return Promise.resolve(this.subjects.get(subjectRef) ?? null);
	}
}

class FixedExemptions implements RateLimitExemptionListPort {
	public list(): readonly RateLimitExemptionEntry[] {
		return [{ kind: "load-test", label: "Load Test tenant" }];
	}
}

class NoOverrides implements TenantRateLimitOverridesPort {
	public allowanceFor(): Promise<null> {
		return Promise.resolve(null);
	}
	public list(): Promise<readonly TenantRateLimitOverride[]> {
		return Promise.resolve([]);
	}
	public set(_input: SetTenantRateLimitOverrideInput): Promise<TenantRateLimitOverride> {
		return Promise.reject(new Error("not used"));
	}
	public remove(): Promise<boolean> {
		return Promise.resolve(false);
	}
}

function refusal(policyName: string, subjectRef: string, minutesAgo: number, penalized = false): RecordedRateLimitRefusal {
	return { policyName, subjectKind: "ip", maskedSubject: "203.0.113.•", subjectRef, penalized, atEpochMs: NOW - minutesAgo * MINUTE };
}

function service(refusals: RateLimitRefusalsPort, limiter = new RecordingRateLimiter()): OperationsTrafficService {
	const policies = new RateLimitPolicyRegistry();
	policies.register(
		{ name: "SECURITY_ROUTES", algorithm: "sliding-window", subject: "ip", limit: "3–30 per 1 min, by route", failMode: "closed", penalty: true },
		{ name: "TENANT_TRAFFIC", algorithm: "token-bucket", subject: "tenant", limit: "50/s, burst 200", failMode: "open", penalty: false },
	);
	return new OperationsTrafficService({
		clock: new FixedClock(),
		policies,
		refusals,
		exemptions: new FixedExemptions(),
		overrides: new NoOverrides(),
		limiter,
		cache: localAppCache(() => NOW),
		cacheAlertPercent: 80,
	});
}

describe("OperationsTrafficService.rateLimits", () => {
	it("counts each policy's refusals over the hour in 10-minute buckets, oldest first", async () => {
		const overview = await service(
			new FixedRefusals([refusal("SECURITY_ROUTES", REF_A, 1), refusal("SECURITY_ROUTES", REF_A, 2), refusal("SECURITY_ROUTES", REF_B, 55)]),
		).rateLimits();

		expect(overview.policies.map((policy) => [policy.name, policy.refusedLastHour, policy.refusalsByTenMinutes])).toEqual([
			["SECURITY_ROUTES", 3, [1, 0, 0, 0, 0, 2]],
			["TENANT_TRAFFIC", 0, [0, 0, 0, 0, 0, 0]],
		]);
		expect(overview.exemptions).toEqual([{ kind: "load-test", label: "Load Test tenant" }]);
	});

	it("ranks the most limited subjects, masked, with the newest refusal time and any penalty", async () => {
		const overview = await service(
			new FixedRefusals([refusal("SECURITY_ROUTES", REF_A, 1, true), refusal("SECURITY_ROUTES", REF_B, 2), refusal("SECURITY_ROUTES", REF_A, 3)]),
		).rateLimits();

		expect(overview.topSubjects).toEqual([
			{ policyName: "SECURITY_ROUTES", subjectKind: "ip", maskedSubject: "203.0.113.•", subjectRef: REF_A, refusals: 2, penalized: true, lastRefusedAt: NOW - MINUTE },
			{ policyName: "SECURITY_ROUTES", subjectKind: "ip", maskedSubject: "203.0.113.•", subjectRef: REF_B, refusals: 1, penalized: false, lastRefusedAt: NOW - 2 * MINUTE },
		]);
	});
});

describe("OperationsTrafficService.liftPenalty", () => {
	it("lifts the penalty of the subject the reference names", async () => {
		const limiter = new RecordingRateLimiter((): number => NOW);
		const request: RateLimitRequest = {
			policyName: "SECURITY_ROUTES",
			rule: { algorithm: "sliding-window", limit: 1, windowMs: MINUTE, penalty: PENALTY },
			subject: IP,
			cost: 1,
			failMode: "closed",
		};
		for (let attempt = 0; attempt < 1 + PENALTY.strikeThreshold; attempt += 1) {
			await limiter.consume(request);
		}
		expect((await limiter.consume(request)).penalized).toBe(true);

		await service(new FixedRefusals([], new Map([[REF_A, { policyName: "SECURITY_ROUTES", subject: IP }]])), limiter).liftPenalty({
			subjectRef: REF_A,
			reason: "Office NAT, cleared",
		});

		expect((await limiter.consume(request)).penalized).toBe(false);
	});

	it("says the subject is gone once its reference has expired", async () => {
		await expect(service(new FixedRefusals([])).liftPenalty({ subjectRef: REF_A, reason: "Office NAT, cleared" })).rejects.toBeInstanceOf(RateLimitSubjectGoneError);
	});
});

describe("OperationsTrafficService.cache", () => {
	it("reports each namespace's counters and hit ratio, and no Redis without one", async () => {
		const traffic = service(new FixedRefusals([]));
		const overview = await traffic.cache();

		expect(overview.redis).toBeNull();
		expect(overview.circuitOpen).toBe(false);
		expect(overview.namespaces.every((namespace) => namespace.hitRatio === null)).toBe(true);
	});

	it("flushes a known namespace and refuses an unknown one", async () => {
		const cache = localAppCache(() => NOW);
		const sample = defineCache<{ readonly value: number }, "platform">({
			name: "test.sample",
			version: 1,
			schema: z.object({ value: z.number() }),
			scope: "platform",
			tier: "local",
			ttlMs: MINUTE,
			staleMs: 0,
			containsPersonalData: false,
			localMaxEntries: 10,
			sharedMaxKeys: 10,
		});
		cache.register(sample);
		await cache.set(sample, PLATFORM_SCOPE, "one", { value: 1 });
		const policies = new RateLimitPolicyRegistry();
		const traffic = new OperationsTrafficService({
			clock: new FixedClock(),
			policies,
			refusals: new FixedRefusals([]),
			exemptions: new FixedExemptions(),
			overrides: new NoOverrides(),
			limiter: new RecordingRateLimiter(),
			cache,
			cacheAlertPercent: 80,
		});

		await traffic.flushCache({ target: "namespace", name: "test.sample", reason: "Stale values after a manual fix" });

		expect(await cache.peek(sample, PLATFORM_SCOPE, "one")).toBeNull();
		await expect(traffic.flushCache({ target: "namespace", name: "test.missing", reason: "Stale values after a manual fix" })).rejects.toBeInstanceOf(NotFoundError);
	});
});
