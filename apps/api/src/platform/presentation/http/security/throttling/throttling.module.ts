import { type DynamicModule, Module, type OnModuleInit } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { ConfigModule } from "../../../../../config/config.module";
import { TypedConfigService } from "../../../../../config/typed-config.service";
import { describeSlidingWindow, describeWindow, RateLimitPolicyRegistry } from "../../../../application/rate-limiting/rate-limit-policy-registry";
import { RateLimiterThrottlerStorage, throttlerPolicyName } from "../../../../infrastructure/throttling/rate-limiter-throttler.storage";
import { ThrottlerStorageModule } from "../../../../infrastructure/throttling/throttler-storage.module";
import { PreAuthThrottlerGuard, PrincipalThrottlerGuard } from "./scoped-throttler.guards";
import { PRE_AUTH_LIMIT_MULTIPLIER, PRE_AUTH_THROTTLER, RATE_LIMIT_POLICY, type RateLimitPolicy } from "./rate-limit-policy";
import { throttlerOptionsFactory } from "./throttler-options.factory";

/**
 * The only `ThrottlerModule` registration in the app (named `strict`, `default`
 * and `webhook` throttlers). `ThrottlerModule` is global, so a second
 * registration anywhere would compete for `THROTTLER_OPTIONS` and the global
 * `ThrottlerGuard` could pick up the wrong one (review finding 1).
 */
const throttlerRegistration: DynamicModule = ThrottlerModule.forRootAsync({
	imports: [ConfigModule, ThrottlerStorageModule],
	inject: [TypedConfigService, RateLimiterThrottlerStorage],
	useFactory: throttlerOptionsFactory,
});

/** Imported once from `AppModule`. The two scoped guards run as `APP_GUARD`s (`APP_GUARD_ORDER`). */
@Module({
	imports: [throttlerRegistration, ThrottlerStorageModule],
	providers: [PreAuthThrottlerGuard, PrincipalThrottlerGuard],
	exports: [throttlerRegistration, ThrottlerStorageModule, PreAuthThrottlerGuard, PrincipalThrottlerGuard],
})
export class ThrottlingModule implements OnModuleInit {
	public constructor(
		private readonly registry: RateLimitPolicyRegistry,
		private readonly config: TypedConfigService,
	) {}

	/** The route throttlers, as the admin Rate limits page lists them (ADR 071). */
	public onModuleInit(): void {
		const { throttleDefaultLimit, throttleTtlMs } = this.config.rateLimits;
		const policies: readonly RateLimitPolicy[] = Object.values(RATE_LIMIT_POLICY);
		const strictLimits = policies.filter((policy: RateLimitPolicy): boolean => policy.throttler === "strict").map((policy: RateLimitPolicy): number => policy.limit);
		const webhook = RATE_LIMIT_POLICY.webhook;
		this.registry.register(
			{
				name: throttlerPolicyName(PRE_AUTH_THROTTLER),
				algorithm: "sliding-window",
				subject: "ip",
				limit: describeSlidingWindow(throttleDefaultLimit * PRE_AUTH_LIMIT_MULTIPLIER, throttleTtlMs),
				failMode: "closed",
				penalty: true,
			},
			{
				name: throttlerPolicyName("strict"),
				algorithm: "sliding-window",
				subject: "ip",
				limit: `${String(Math.min(...strictLimits))}–${String(Math.max(...strictLimits))} per ${describeWindow(throttleTtlMs)}, by route`,
				failMode: "closed",
				penalty: true,
			},
			{
				name: throttlerPolicyName("default"),
				algorithm: "sliding-window",
				subject: "principal",
				limit: describeSlidingWindow(throttleDefaultLimit, throttleTtlMs),
				failMode: "open",
				penalty: false,
			},
			{
				name: throttlerPolicyName("webhook"),
				algorithm: "sliding-window",
				subject: "ip",
				limit: describeSlidingWindow(webhook.limit, webhook.ttlMs),
				failMode: "open",
				penalty: false,
			},
		);
	}
}
