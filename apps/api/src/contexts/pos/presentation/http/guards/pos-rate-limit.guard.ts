import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";

import { RateLimitError } from "../../../../../platform/application/errors/app-error";
import { RATE_LIMITER, type RateLimiter } from "../../../../../platform/application/ports/rate-limiter.port";
import { getTillPointFromRequest, type ApiKeyAuthRequest } from "../../../../../platform/presentation/http/security/api-keys/api-key-request";

/** Window of the per-API-key POS limit. */
export const POS_RATE_LIMIT_TTL_MS = 60_000;

/**
 * Redemption calls one API key may make per window. A till scans a few codes a minute; a busy store's
 * integration key stays far below. Counted per KEY, not per IP: stores behind one NAT must not
 * throttle each other, and a key cannot escape its limit by changing (or spoofing) its source address.
 */
export const POS_RATE_LIMIT_PER_KEY = 120;

/** Name of this policy in the shared rate limiter (key segment and refusal-log name). */
export const POS_RATE_LIMIT_POLICY = "POS_API_KEY";

const MS_PER_SECOND = 1_000;

/** 429 — one API key made more redemption calls than {@link POS_RATE_LIMIT_PER_KEY} in the window. */
export class PosRateLimitedError extends RateLimitError {
	public constructor(retryAfterSeconds: number) {
		super({ code: "POS_RATE_LIMITED", message: "Too many requests from this API key — slow down and retry shortly.", details: { retryAfterSeconds } });
	}
}

/**
 * Per-API-key rate limit for `/redemptions/*`, counted by the shared `RateLimiter` (ADR 071, a rolling
 * window). Runs AFTER `MerchantApiKeyGuard` — list it second in `@UseGuards`.
 */
@Injectable()
export class PosRateLimitGuard implements CanActivate {
	public constructor(@Inject(RATE_LIMITER) private readonly limiter: RateLimiter) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const { apiKeyId } = getTillPointFromRequest(context.switchToHttp().getRequest<ApiKeyAuthRequest>());
		const decision = await this.limiter.consume({
			policyName: POS_RATE_LIMIT_POLICY,
			rule: { algorithm: "sliding-window", limit: POS_RATE_LIMIT_PER_KEY, windowMs: POS_RATE_LIMIT_TTL_MS, penalty: null },
			subject: { kind: "apiKey", id: apiKeyId },
			cost: 1,
			failMode: "open",
		});
		if (!decision.allowed) {
			throw new PosRateLimitedError(Math.max(1, Math.ceil(decision.retryAfterMs / MS_PER_SECOND)));
		}
		return true;
	}
}
