// ============================================
// platform/presentation/http/security/throttling/tenant-traffic.guard.ts — TENANT_TRAFFIC and API_KEY_TRAFFIC (ADR 071)
// ============================================
// Every tenant-scoped request spends one token of its tenant's bucket (members and keys together), and an
// API key's request one of its own bucket too. A tenant override replaces the default for that tenant
// (cached, ADR 072). Runs after `AuthorizationGuard`, which binds the request's tenant: a request refused
// for authorization never spends a tenant's bucket. Fails open: general traffic must not stop because
// Redis did (the local fallback takes the limit divided by the expected instances).

import { Inject, Injectable, Logger, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { RateLimitAllowance, TenantRateLimitPolicyName } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { TypedConfigService } from "../../../../../config/typed-config.service";
import type { TokenBucketDefaults } from "../../../../../config/api-config/api-config.types";
import { RateLimitError } from "../../../../application/errors/app-error";
import { RATE_LIMITER, type RateLimiter, type RateLimitSubject, type TokenBucketRule } from "../../../../application/ports/rate-limiter.port";
import { TENANT_RATE_LIMIT_OVERRIDES, type TenantRateLimitOverridesPort } from "../../../../application/ports/tenant-rate-limit-overrides.port";
import { RequestContextService } from "../../../../infrastructure/context/request-context";
import { RateLimitExemptions } from "../../../../infrastructure/rate-limiting/rate-limit-exemptions";
import { RateLimitRefusalLog } from "../../../../infrastructure/rate-limiting/rate-limit-refusal-log";

const MS_PER_SECOND = 1_000;
const ONE_REQUEST = 1;

/** A stored allowance (`limit` per `windowMs`) as the limiter's bucket. */
export function allowanceRule(allowance: RateLimitAllowance): TokenBucketRule {
	return { algorithm: "token-bucket", ratePerSecond: (allowance.limit * MS_PER_SECOND) / allowance.windowMs, burst: allowance.limit };
}

function defaultRule(defaults: TokenBucketDefaults): TokenBucketRule {
	return { algorithm: "token-bucket", ratePerSecond: defaults.ratePerSecond, burst: defaults.burst };
}

@Injectable()
export class TenantTrafficGuard implements CanActivate {
	private readonly logger: Logger = new Logger(TenantTrafficGuard.name);

	public constructor(
		private readonly config: TypedConfigService,
		private readonly requestContext: RequestContextService,
		@Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
		@Inject(TENANT_RATE_LIMIT_OVERRIDES) private readonly overrides: TenantRateLimitOverridesPort,
		private readonly exemptions: RateLimitExemptions,
		private readonly refusals: RateLimitRefusalLog,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const current = this.requestContext.current();
		const apiKey = current?.apiKey;
		const tenantId = apiKey?.tenantId ?? current?.tenant.tenantId;
		if (tenantId === undefined) {
			return true;
		}
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		await this.spend(request, "TENANT_TRAFFIC", tenantId, { kind: "tenant", id: tenantId }, this.config.rateLimits.tenantTraffic);
		if (apiKey !== undefined) {
			await this.spend(request, "API_KEY_TRAFFIC", tenantId, { kind: "apiKey", id: apiKey.apiKeyId }, this.config.rateLimits.apiKeyTraffic);
		}
		return true;
	}

	private async spend(
		request: FastifyRequest,
		policyName: TenantRateLimitPolicyName,
		tenantId: string,
		subject: RateLimitSubject,
		defaults: TokenBucketDefaults,
	): Promise<void> {
		const override = await this.overrideOrDefault(tenantId, policyName);
		const decision = await this.limiter.consume({
			policyName,
			rule: override === null ? defaultRule(defaults) : allowanceRule(override),
			subject,
			cost: ONE_REQUEST,
			failMode: "open",
		});
		if (decision.allowed || (await this.exemptions.reasonFor(request)) !== null) {
			// Exempt traffic (a live load-test key, a monitoring range) was counted above, never refused.
			return;
		}
		await this.refusals.record({ policyName, subject, penalized: false });
		throw new RateLimitError({ message: "Too many requests for this business right now", details: { retryAfterSeconds: Math.ceil(decision.retryAfterMs / MS_PER_SECOND) } });
	}

	/**
	 * The tenant's override, or null for the default. General traffic fails open (ADR 071): when the
	 * overrides cannot be read, the default applies and the failure is logged, never a refused request.
	 */
	private async overrideOrDefault(tenantId: string, policyName: TenantRateLimitPolicyName): Promise<RateLimitAllowance | null> {
		try {
			return await this.overrides.allowanceFor(tenantId, policyName);
		} catch (error) {
			this.logger.warn({ event: "rate_limit.overrides_unavailable", policyName, tenantId, message: error instanceof Error ? error.message : "unknown failure" });
			return null;
		}
	}
}
