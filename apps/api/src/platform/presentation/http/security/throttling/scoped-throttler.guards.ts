import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard, type ThrottlerModuleOptions, type ThrottlerRequest, type ThrottlerStorage } from "@nestjs/throttler";

import { RateLimitError } from "../../../../application/errors/app-error";
import { hasAuthenticatedPrincipal } from "../../../../infrastructure/http/client-ip";
import { RateLimitExemptions } from "../../../../infrastructure/rate-limiting/rate-limit-exemptions";
import { RateLimitRefusalLog } from "../../../../infrastructure/rate-limiting/rate-limit-refusal-log";
import { SECURITY_THROTTLERS, throttlerPolicyName } from "../../../../infrastructure/throttling/rate-limiter-throttler.storage";
import { PRE_AUTH_THROTTLER } from "./rate-limit-policy";

/** The IETF `RateLimit` header fields (draft-ietf-httpapi-ratelimit-headers). */
export const RATE_LIMIT_POLICY_HEADER = "RateLimit-Policy";
export const RATE_LIMIT_HEADER = "RateLimit";

const MS_PER_SECOND = 1_000;

/** The policy nearest its limit so far on one request: its headers are the ones sent. */
interface HeaderChoice {
	readonly usedShare: number;
}

/** Sets one response header. */
type SetHeader = (name: string, value: string) => void;

/**
 * The guards' shared counting (ADR 071):
 *
 * - Exempt traffic (a live load-test key, `RATE_LIMIT_EXEMPT_CIDRS`) is counted but never refused.
 * - A refusal is logged (`rate_limit.refused`, the capped refusal stream) and answered with the one
 *   `RateLimitError` envelope and `Retry-After` in seconds.
 * - Only an authenticated user or API key receives the `RateLimit-Policy` / `RateLimit` headers, for
 *   the policy nearest its limit; an unauthenticated caller learns nothing about attempts left.
 */
abstract class PolicyThrottlerGuard extends ThrottlerGuard {
	private readonly headerChoices: WeakMap<object, HeaderChoice> = new WeakMap<object, HeaderChoice>();

	public constructor(
		options: ThrottlerModuleOptions,
		storage: ThrottlerStorage,
		reflector: Reflector,
		private readonly exemptions: RateLimitExemptions,
		private readonly refusals: RateLimitRefusalLog,
	) {
		super(options, storage, reflector);
	}

	protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
		const { context, limit, ttl, throttler, blockDuration, getTracker, generateKey } = requestProps;
		const { req, res } = this.getRequestResponse(context);
		const throttlerName = throttler.name ?? "default";
		const tracker = await getTracker(req, context);
		const key = generateKey(context, tracker, throttlerName);
		const record = await this.storageService.increment(key, ttl, limit, blockDuration, throttlerName);
		if (record.isBlocked) {
			if ((await this.exemptions.reasonFor(req)) !== null) {
				// Counted above, so the admin page sees it; never refused, and not a refusal to log.
				return true;
			}
			await this.refusals.record({
				policyName: throttlerPolicyName(throttlerName),
				subject: { kind: throttlerName === "default" ? "principal" : "ip", id: tracker },
				penalized: SECURITY_THROTTLERS.includes(throttlerName) && record.timeToBlockExpire * MS_PER_SECOND > ttl,
			});
			const message = await this.getErrorMessage(context, { ...record, ttl, limit, key, tracker });
			throw new RateLimitError({ message, details: { retryAfterSeconds: record.timeToBlockExpire } });
		}
		if (hasAuthenticatedPrincipal(req)) {
			this.setRateLimitHeaders(
				req,
				(name: string, value: string): void => {
					this.setResponseHeader(res, name, value);
				},
				throttlerPolicyName(throttlerName),
				limit,
				ttl,
				record.totalHits,
				record.timeToExpire,
			);
		}
		return true;
	}

	private setRateLimitHeaders(request: object, setHeader: SetHeader, name: string, limit: number, ttlMs: number, used: number, resetSeconds: number): void {
		const usedShare = used / limit;
		const previous = this.headerChoices.get(request);
		if (previous !== undefined && previous.usedShare > usedShare) {
			return;
		}
		this.headerChoices.set(request, { usedShare });
		setHeader(RATE_LIMIT_POLICY_HEADER, `"${name}";q=${String(limit)};w=${String(Math.ceil(ttlMs / MS_PER_SECOND))}`);
		setHeader(RATE_LIMIT_HEADER, `"${name}";r=${String(Math.max(0, limit - used))};t=${String(resetSeconds)}`);
	}
}

/**
 * The coarse pre-authentication throttler only (`preAuth`, per client IP).
 * Registered BEFORE `AuthGuard` in `APP_GUARD_ORDER`, so requests with bad or
 * missing credentials are counted before authentication rejects them.
 */
@Injectable()
export class PreAuthThrottlerGuard extends PolicyThrottlerGuard {
	public constructor(
		@InjectThrottlerOptions() options: ThrottlerModuleOptions,
		@InjectThrottlerStorage() storage: ThrottlerStorage,
		reflector: Reflector,
		exemptions: RateLimitExemptions,
		refusals: RateLimitRefusalLog,
	) {
		super(options, storage, reflector, exemptions, refusals);
	}

	public override async onModuleInit(): Promise<void> {
		await super.onModuleInit();
		this.throttlers = this.throttlers.filter((throttler): boolean => throttler.name === PRE_AUTH_THROTTLER);
	}
}

/**
 * Every named throttler except `preAuth` (`strict`, `default`, `webhook`).
 * Registered AFTER `AuthGuard`, so the principal tracker sees `request.user`.
 */
@Injectable()
export class PrincipalThrottlerGuard extends PolicyThrottlerGuard {
	public constructor(
		@InjectThrottlerOptions() options: ThrottlerModuleOptions,
		@InjectThrottlerStorage() storage: ThrottlerStorage,
		reflector: Reflector,
		exemptions: RateLimitExemptions,
		refusals: RateLimitRefusalLog,
	) {
		super(options, storage, reflector, exemptions, refusals);
	}

	public override async onModuleInit(): Promise<void> {
		await super.onModuleInit();
		this.throttlers = this.throttlers.filter((throttler): boolean => throttler.name !== PRE_AUTH_THROTTLER);
	}
}
