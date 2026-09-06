import type { ThrottlerModuleOptions } from "@nestjs/throttler";
import { HttpHeaderValueSchema, RequestLikeSchema, type RequestLike } from "@workspace/shared";

import type { TypedConfigService } from "../../../config/typed-config.service";

const UNKNOWN_CLIENT = "unknown";

/** Resolve client IP for auth rate limiting (same order as webhook throttler). */
export function resolveAuthClientIp(req: RequestLike): string {
	const parsed = RequestLikeSchema.safeParse(req);
	if (!parsed.success) {
		return UNKNOWN_CLIENT;
	}
	const headers = parsed.data.headers ?? {};
	const headerStr = (raw: unknown): string => {
		const v = HttpHeaderValueSchema.safeParse(raw);
		if (!v.success) {
			return "";
		}
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
 * Named throttlers used by `@Throttle({ strict: … })` and `@Throttle({ default: … })`
 * on auth controllers. `strict` guards credential endpoints; `default` covers
 * authenticated mutations.
 */
export function authThrottlerOptionsFactory(_config: TypedConfigService): ThrottlerModuleOptions {
	return {
		errorMessage: "Too many requests — please try again shortly.",
		getTracker: (req: Record<string, string>): string => resolveAuthClientIp(req),
		throttlers: [
			{ name: "strict", ttl: 60_000, limit: 10 },
			{ name: "default", ttl: 60_000, limit: 60 },
		],
	};
}
