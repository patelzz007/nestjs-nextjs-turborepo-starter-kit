import { CanActivate, Inject, Injectable } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import { ANALYTICS_EXPORT_RATE_LIMIT, ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS } from "@workspace/shared";

import { RequestContextService, type RequestContext } from "../../../common/context/request-context";
import { RateLimitError } from "../../../common/errors/app-error";

/** Name of this limiter in the shared throttler store. */
const ANALYTICS_EXPORT_THROTTLER_NAME = "analytics-export";

/** Exceeding the limit adds no separate block period: the window has to roll over. */
const NO_BLOCK_DURATION_MS = 0;

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;

/** The caller authentication resolved before this guard ran, neither a user nor an API key. */
export class AnalyticsExportCallerMissingError extends Error {
	public constructor() {
		super("Analytics export rate limit needs an authenticated user or API key — the route must not be @Public()");
		this.name = "AnalyticsExportCallerMissingError";
	}
}

/** 429 — the caller started too many exports in the window. */
export class AnalyticsExportRateLimitedError extends RateLimitError {
	public constructor(retryAfterSeconds: number) {
		super({
			code: "ANALYTICS_EXPORT_RATE_LIMITED",
			message: `You can start at most ${String(ANALYTICS_EXPORT_RATE_LIMIT)} exports every ${String(ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS / MS_PER_MINUTE)} minutes. Try again shortly.`,
			details: { retryAfterSeconds },
		});
	}
}

/** The throttle key of the request's caller: the user (never their IP — offices share one), else the API key. */
export function exportCallerKey(context: RequestContext | undefined): string {
	if (context?.principal !== undefined) {
		return `user:${context.principal.userId}`;
	}
	if (context?.apiKey !== undefined) {
		return `api-key:${context.apiKey.apiKeyId}`;
	}
	throw new AnalyticsExportCallerMissingError();
}

/**
 * Per-caller limit on analytics exports: {@link ANALYTICS_EXPORT_RATE_LIMIT}
 * per {@link ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS}, counted in the shared
 * (Redis-backed) throttler store so every API instance enforces the same
 * budget. Keyed by the authenticated user — or the API key for a machine
 * caller — that the global auth guard already verified. Answers
 * `429 ANALYTICS_EXPORT_RATE_LIMITED` with `Retry-After`.
 */
@Injectable()
export class AnalyticsExportRateLimitGuard implements CanActivate {
	public constructor(
		@Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
		private readonly requestContext: RequestContextService,
	) {}

	public async canActivate(): Promise<boolean> {
		const key = exportCallerKey(this.requestContext.current());
		const record = await this.storage.increment(
			`${ANALYTICS_EXPORT_THROTTLER_NAME}:${key}`,
			ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS,
			ANALYTICS_EXPORT_RATE_LIMIT,
			NO_BLOCK_DURATION_MS,
			ANALYTICS_EXPORT_THROTTLER_NAME,
		);
		if (record.totalHits > ANALYTICS_EXPORT_RATE_LIMIT) {
			throw new AnalyticsExportRateLimitedError(Math.max(1, Math.ceil(record.timeToExpire / MS_PER_SECOND)));
		}
		return true;
	}
}
