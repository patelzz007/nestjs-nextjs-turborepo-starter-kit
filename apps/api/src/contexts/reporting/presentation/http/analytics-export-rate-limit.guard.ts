import { CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import { ANALYTICS_EXPORT_RATE_LIMIT, ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { RateLimitError } from "../../../../platform/application/errors/app-error";
import { ActorContextFactory, type ActorContextFromHttpOptions } from "../../../../platform/presentation/http/security/actor-context.factory";

/** Name of this limiter in the shared throttler store. */
const ANALYTICS_EXPORT_THROTTLER_NAME = "analytics-export";

/** Exceeding the limit adds no separate block period: the window has to roll over. */
const NO_BLOCK_DURATION_MS = 0;

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;

/** Resolves who is calling (the security kit's `ActorContextFactory`). */
export interface HttpActorResolver {
	fromHttpRequest(request: FastifyRequest, options?: ActorContextFromHttpOptions): ActorContext;
}

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
export function exportCallerKey(actor: ActorContext): string {
	if (actor.kind === "user") {
		return `user:${actor.userId}`;
	}
	if (actor.kind === "api_key") {
		return `api-key:${actor.apiKeyId}`;
	}
	throw new AnalyticsExportCallerMissingError();
}

/**
 * Per-caller limit on analytics exports: {@link ANALYTICS_EXPORT_RATE_LIMIT}
 * per {@link ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS}, counted in the shared
 * (Redis-backed) throttler store so every API instance enforces the same
 * budget. Keyed by the authenticated user — or the API key for a machine
 * caller — that the global auth guards already verified. Answers
 * `429 ANALYTICS_EXPORT_RATE_LIMITED` with `Retry-After`.
 */
@Injectable()
export class AnalyticsExportRateLimitGuard implements CanActivate {
	public constructor(
		@Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
		@Inject(ActorContextFactory) private readonly actors: HttpActorResolver,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const key = exportCallerKey(this.actors.fromHttpRequest(request, { allowAnonymous: true }));
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
