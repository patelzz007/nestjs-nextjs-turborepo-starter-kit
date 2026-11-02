import { CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { ANALYTICS_EXPORT_RATE_LIMIT, ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { RateLimitError } from "../../../../platform/application/errors/app-error";
import { RATE_LIMITER, type RateLimiter } from "../../../../platform/application/ports/rate-limiter.port";
import { ActorContextFactory, type ActorContextFromHttpOptions } from "../../../../platform/presentation/http/security/actor-context.factory";

/** Name of this policy in the shared rate limiter (key segment and refusal-log name). */
export const ANALYTICS_EXPORT_POLICY = "ANALYTICS_EXPORT";

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
 * rate limiter (ADR 071, a rolling window) so every API instance enforces the same
 * budget. Keyed by the authenticated user — or the API key for a machine
 * caller — that the global auth guards already verified. Answers
 * `429 ANALYTICS_EXPORT_RATE_LIMITED` with `Retry-After`.
 */
@Injectable()
export class AnalyticsExportRateLimitGuard implements CanActivate {
	public constructor(
		@Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
		@Inject(ActorContextFactory) private readonly actors: HttpActorResolver,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const actor = this.actors.fromHttpRequest(request, { allowAnonymous: true });
		const key = exportCallerKey(actor);
		const decision = await this.limiter.consume({
			policyName: ANALYTICS_EXPORT_POLICY,
			rule: { algorithm: "sliding-window", limit: ANALYTICS_EXPORT_RATE_LIMIT, windowMs: ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS, penalty: null },
			subject: { kind: actor.kind === "user" ? "principal" : "apiKey", id: key },
			cost: 1,
			failMode: "open",
		});
		if (!decision.allowed) {
			throw new AnalyticsExportRateLimitedError(Math.max(1, Math.ceil(decision.retryAfterMs / MS_PER_SECOND)));
		}
		return true;
	}
}
