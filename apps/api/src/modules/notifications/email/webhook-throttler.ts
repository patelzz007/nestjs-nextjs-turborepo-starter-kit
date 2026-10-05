import type { ThrottlerModuleOptions } from "@nestjs/throttler";

import { throttleTrackerFor } from "../../../common/http/client-ip";
import type { TypedConfigService } from "../../../config/typed-config.service";

/**
 * Build the per-IP rate-limit options for the public delivery-webhook route.
 *
 * Defense-in-depth: the endpoint is already signature-verified, but the route
 * is public, so a client (attacker or misbehaving script) could hammer it —
 * every request costs signature work + log lines. The fixed-window limiter
 * caps requests per IP per minute; a request that 403s on signature still
 * counts (the guard runs before the handler), which is exactly what we want
 * for abuse.
 *
 * `WEBHOOK_RATE_LIMIT_PER_MINUTE=0` disables the limiter entirely (empty
 * throttlers = the guard passes everything).
 */
export function webhookThrottlerOptionsFactory(config: TypedConfigService): ThrottlerModuleOptions {
	const limitPerMinute: number = config.email.webhookRateLimitPerMinute;
	return {
		errorMessage: "Too many webhook requests — this endpoint is rate-limited per IP (WEBHOOK_RATE_LIMIT_PER_MINUTE). Try again shortly.",
		getTracker: (req: Record<string, string>): string => throttleTrackerFor(req),
		throttlers: limitPerMinute > 0 ? [{ name: "webhook", ttl: 60_000, limit: limitPerMinute }] : [],
	};
}
