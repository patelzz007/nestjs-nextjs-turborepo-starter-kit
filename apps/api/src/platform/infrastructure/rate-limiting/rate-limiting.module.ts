import { Global, Logger, Module, type OnModuleInit } from "@nestjs/common";
import type Redis from "ioredis";

import { TypedConfigService } from "../../../config/typed-config.service";
import { describeTokenBucket, RateLimitPolicyRegistry } from "../../application/rate-limiting/rate-limit-policy-registry";
import { RATE_LIMITER, type RateLimiter } from "../../application/ports/rate-limiter.port";
import { RATE_LIMIT_EXEMPTION_LIST, RATE_LIMIT_REFUSALS } from "../../application/ports/rate-limit-insights.port";
import { REDIS_PUBLISHER } from "../redis/redis.tokens";
import { FailoverRateLimiter } from "./failover-rate-limiter";
import { MemoryRateLimiter } from "./memory-rate-limiter";
import { RateLimitExemptions } from "./rate-limit-exemptions";
import { RateLimitRefusalLog } from "./rate-limit-refusal-log";
import { ioredisScriptClient, RedisRateLimiter } from "./redis-rate-limiter";
import { LoadTestTrafficKeys } from "../throttling/load-test-traffic-keys";

/** The shared limiter (Redis, atomic scripts) with its local fallback; local only without Redis. */
export function createRateLimiter(config: TypedConfigService, redis: Redis | null): RateLimiter {
	const local = new MemoryRateLimiter({ maxKeys: config.rateLimits.securityCounterMaxKeys });
	const shared = redis === null ? null : new RedisRateLimiter(ioredisScriptClient(redis), config.redisNamespace);
	return new FailoverRateLimiter(shared, local, config.rateLimits.expectedInstances, new Logger("RateLimiter"));
}

/** The one `RateLimiter` every limit in the API uses (ADR 071), plus the load-test traffic keys, exemptions, the refusal log and the policy registry (tenant overrides: `TenantRateLimitOverridesModule`). */
@Global()
@Module({
	providers: [
		{ provide: RATE_LIMITER, inject: [TypedConfigService, REDIS_PUBLISHER], useFactory: createRateLimiter },
		LoadTestTrafficKeys,
		RateLimitExemptions,
		RateLimitRefusalLog,
		RateLimitPolicyRegistry,
		{ provide: RATE_LIMIT_REFUSALS, useExisting: RateLimitRefusalLog },
		{ provide: RATE_LIMIT_EXEMPTION_LIST, useExisting: RateLimitExemptions },
	],
	exports: [RATE_LIMITER, LoadTestTrafficKeys, RateLimitExemptions, RateLimitRefusalLog, RateLimitPolicyRegistry, RATE_LIMIT_REFUSALS, RATE_LIMIT_EXEMPTION_LIST],
})
export class RateLimitingModule implements OnModuleInit {
	public constructor(
		private readonly registry: RateLimitPolicyRegistry,
		private readonly config: TypedConfigService,
	) {}

	/** The tenant policies this module's guard counts (`TenantTrafficGuard`). */
	public onModuleInit(): void {
		const { tenantTraffic, apiKeyTraffic } = this.config.rateLimits;
		this.registry.register(
			{
				name: "TENANT_TRAFFIC",
				algorithm: "token-bucket",
				subject: "tenant",
				limit: describeTokenBucket(tenantTraffic.ratePerSecond, tenantTraffic.burst),
				failMode: "open",
				penalty: false,
			},
			{
				name: "API_KEY_TRAFFIC",
				algorithm: "token-bucket",
				subject: "apiKey",
				limit: describeTokenBucket(apiKeyTraffic.ratePerSecond, apiKeyTraffic.burst),
				failMode: "open",
				penalty: false,
			},
		);
	}
}
