import type { RateLimitAllowance, SetTenantRateLimitOverrideInput, TenantRateLimitOverride, TenantRateLimitPolicyName } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createHttpContext, testRequest } from "../../../../../../../test/support/http-execution-context";
import { RecordingRateLimiter } from "../../../../../../../test/support/recording-rate-limiter";
import { createTestTypedConfig } from "../../../../../../../test/support/test-api-env";
import { RateLimitError } from "../../../../../application/errors/app-error";
import type { TenantRateLimitOverridesPort } from "../../../../../application/ports/tenant-rate-limit-overrides.port";
import { RequestContextService } from "../../../../../infrastructure/context/request-context";
import { RateLimitExemptions } from "../../../../../infrastructure/rate-limiting/rate-limit-exemptions";
import { RateLimitRefusalLog } from "../../../../../infrastructure/rate-limiting/rate-limit-refusal-log";
import { LoadTestTrafficKeys } from "../../../../../infrastructure/throttling/load-test-traffic-keys";
import { allowanceRule, TenantTrafficGuard } from "../tenant-traffic.guard";

const TENANT = "0193f2c4-0000-7000-8000-0000000000e1";
const API_KEY = "0193f2c4-0000-7000-8000-0000000000e2";
/** A small default so a test reaches the limit quickly: 1/s, burst 3 (tenant) and 1/s, burst 2 (key). */
const ENV = {
	RATE_LIMIT_TENANT_RATE_PER_SECOND: "1",
	RATE_LIMIT_TENANT_BURST: "3",
	RATE_LIMIT_API_KEY_RATE_PER_SECOND: "1",
	RATE_LIMIT_API_KEY_BURST: "2",
};

/** Overrides as a fixed map (the cached port's behaviour is tested on its own). */
class FixedOverrides implements TenantRateLimitOverridesPort {
	public constructor(private readonly allowances: ReadonlyMap<string, RateLimitAllowance> = new Map()) {}

	public allowanceFor(tenantId: string, policyName: TenantRateLimitPolicyName): Promise<RateLimitAllowance | null> {
		return Promise.resolve(this.allowances.get(`${tenantId}:${policyName}`) ?? null);
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

function setup(overrides: TenantRateLimitOverridesPort = new FixedOverrides()): {
	readonly guard: TenantTrafficGuard;
	readonly limiter: RecordingRateLimiter;
	readonly context: RequestContextService;
} {
	const config = createTestTypedConfig(ENV);
	const limiter = new RecordingRateLimiter((): number => 0);
	const context = new RequestContextService();
	const exemptions = new RateLimitExemptions(config, new LoadTestTrafficKeys(config, null));
	return { guard: new TenantTrafficGuard(config, context, limiter, overrides, exemptions, new RateLimitRefusalLog(config, null)), limiter, context };
}

function inRequest<T>(context: RequestContextService, bind: () => void, work: () => Promise<T>): Promise<T> {
	return context.run({ correlationId: "corr-1", ip: "203.0.113.9", userAgent: "vitest", edgeLocation: undefined }, async (): Promise<T> => {
		bind();
		return work();
	});
}

const HTTP = createHttpContext(testRequest());

describe("TenantTrafficGuard", () => {
	it("lets a request without a tenant through without counting", async () => {
		const { guard, limiter, context } = setup();

		await expect(
			inRequest(
				context,
				() => undefined,
				() => guard.canActivate(HTTP),
			),
		).resolves.toBe(true);
		expect(limiter.policiesCounted()).toEqual([]);
	});

	it("spends the tenant's bucket and refuses past its burst with the retry time", async () => {
		const { guard, limiter, context } = setup();
		const bindTenant = (): void => {
			context.bindTenant({ tenantId: TENANT });
		};

		for (let request = 0; request < 3; request += 1) {
			await expect(inRequest(context, bindTenant, () => guard.canActivate(HTTP))).resolves.toBe(true);
		}
		const refused = inRequest(context, bindTenant, () => guard.canActivate(HTTP));

		await expect(refused).rejects.toBeInstanceOf(RateLimitError);
		await expect(refused).rejects.toMatchObject({ details: { retryAfterSeconds: 1 } });
		expect(limiter.policiesCounted().every((policy) => policy === "TENANT_TRAFFIC")).toBe(true);
	});

	it("counts an API key's own bucket beside its tenant's", async () => {
		const { guard, limiter, context } = setup();
		const bindKey = (): void => {
			context.bindApiKey({ apiKeyId: API_KEY, tenantId: TENANT, terminalId: undefined, locationId: null });
		};

		await inRequest(context, bindKey, () => guard.canActivate(HTTP));
		await inRequest(context, bindKey, () => guard.canActivate(HTTP));

		expect(limiter.policiesCounted()).toEqual(["TENANT_TRAFFIC", "API_KEY_TRAFFIC", "TENANT_TRAFFIC", "API_KEY_TRAFFIC"]);
		await expect(inRequest(context, bindKey, () => guard.canActivate(HTTP))).rejects.toBeInstanceOf(RateLimitError);
	});

	it("uses the tenant's override instead of the default", async () => {
		const { guard, context } = setup(new FixedOverrides(new Map([[`${TENANT}:TENANT_TRAFFIC`, { limit: 5, windowMs: 5_000 }]])));
		const bindTenant = (): void => {
			context.bindTenant({ tenantId: TENANT });
		};

		for (let request = 0; request < 5; request += 1) {
			await expect(inRequest(context, bindTenant, () => guard.canActivate(HTTP))).resolves.toBe(true);
		}
		await expect(inRequest(context, bindTenant, () => guard.canActivate(HTTP))).rejects.toBeInstanceOf(RateLimitError);
	});
});

describe("TenantTrafficGuard when the overrides cannot be read", () => {
	it("applies the default limit instead of failing the request (general traffic fails open)", async () => {
		class BrokenOverrides extends FixedOverrides {
			public override allowanceFor(): Promise<RateLimitAllowance | null> {
				return Promise.reject(new Error("database unavailable"));
			}
		}
		const { guard, context } = setup(new BrokenOverrides());
		const bindTenant = (): void => {
			context.bindTenant({ tenantId: TENANT });
		};

		await expect(inRequest(context, bindTenant, () => guard.canActivate(HTTP))).resolves.toBe(true);
	});
});

describe("allowanceRule", () => {
	it("turns `limit` per `windowMs` into a burst and a steady rate", () => {
		expect(allowanceRule({ limit: 200, windowMs: 4_000 })).toEqual({ algorithm: "token-bucket", ratePerSecond: 50, burst: 200 });
	});
});
