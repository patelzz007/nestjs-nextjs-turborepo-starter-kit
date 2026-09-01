import type { ThrottlerModuleOptions } from "@nestjs/throttler";
import { HttpHeaderValueSchema, RequestLikeSchema, type RequestLike } from "@workspace/shared";

import type { TypedConfigService } from "../../../config/typed-config.service";

/** Fallback tracker when a request carries no usable IP information. */
const UNKNOWN_CLIENT = "unknown";

/**
 * Resolve the REAL client IP behind the cloudflared tunnel / Cloudflare edge.
 *
 * The tunnel is the only public ingress, and Cloudflare overwrites
 * `cf-connecting-ip` at the edge (it is not spoofable through the tunnel), so
 * trusting it is safe. Direct localhost access falls back to the socket
 * address. Order:
 *
 * 1. `cf-connecting-ip` — set by Cloudflare's edge, forwarded by cloudflared.
 * 2. first value of `x-forwarded-for` — the tunnel's standard forward header.
 * 3. `req.ip` — the direct socket address (local dev without a tunnel).
 */ export function resolveClientIp(req: RequestLike): string {
	const parsed = RequestLikeSchema.safeParse(req);
	if (!parsed.success) {
		return UNKNOWN_CLIENT;
	}
	const headers = parsed.data.headers ?? {};
	// Helper: extract a single string from a header value (string or string[]).
	const headerStr = (raw: unknown): string => {
		const v = HttpHeaderValueSchema.safeParse(raw);
		if (!v.success) return "";
		return Array.isArray(v.data) ? (v.data[0] ?? "") : v.data;
	};
	const cfConnectingIp: string = headerStr(headers["cf-connecting-ip"]).trim();
	if (cfConnectingIp.length > 0) {
		return cfConnectingIp;
	}
	const forwardedFor: string = headerStr(headers["x-forwarded-for"]).trim();
	const firstHop: string = forwardedFor.split(",")[0]?.trim() ?? "";
	if (firstHop.length > 0) {
		return firstHop;
	}
	return parsed.data.ip !== undefined && parsed.data.ip.trim().length > 0 ? parsed.data.ip.trim() : UNKNOWN_CLIENT;
}

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
	const limitPerMinute: number = config.webhookRateLimitPerMinute;
	return {
		errorMessage: "Too many webhook requests — this endpoint is rate-limited per IP (WEBHOOK_RATE_LIMIT_PER_MINUTE). Try again shortly.",
		getTracker: (req: Record<string, string>): string => resolveClientIp(req),
		throttlers: limitPerMinute > 0 ? [{ name: "webhook", ttl: 60_000, limit: limitPerMinute }] : [],
	};
}
