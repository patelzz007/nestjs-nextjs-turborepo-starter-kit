import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { ANALYTICS_EXPORT_RATE_LIMIT, ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { captureFastifyRequest } from "../../../../../../e2e/support/fastify-request";
import { RecordingRateLimiter } from "../../../../../../e2e/support/recording-rate-limiter";
import type { ActorContext } from "../../../../../platform/application/actor-context";
import { anonymousActor, apiKeyActor, userActor } from "../../../application/__tests__/fakes/analytics-actors";
import {
	AnalyticsExportCallerMissingError,
	AnalyticsExportRateLimitGuard,
	AnalyticsExportRateLimitedError,
	exportCallerKey,
	type HttpActorResolver,
} from "../analytics-export-rate-limit.guard";

/** How far into the window every export in these tests lands. */
const ELAPSED_IN_WINDOW_MS = 1_500;
const MS_PER_SECOND = 1_000;
/** A window start: the clock sits {@link ELAPSED_IN_WINDOW_MS} after it. */
const WINDOW_START_EPOCH_MS = ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS * 1_000;

/** The real in-process limiter (the same algorithm as the Redis script) on a fixed clock. */
function limiter(): RecordingRateLimiter {
	return new RecordingRateLimiter((): number => WINDOW_START_EPOCH_MS + ELAPSED_IN_WINDOW_MS);
}

/** Resolves every request to one fixed actor (the security kit's factory reads it from the request). */
class FixedActorResolver implements HttpActorResolver {
	public readonly requests: FastifyRequest[] = [];

	public constructor(private readonly actor: ActorContext) {}

	public fromHttpRequest(request: FastifyRequest): ActorContext {
		this.requests.push(request);
		return this.actor;
	}
}

async function httpContext(): Promise<ExecutionContextHost> {
	const request = await captureFastifyRequest({ headers: {} });
	return new ExecutionContextHost([request]);
}

describe("exportCallerKey", () => {
	it("keys by the authenticated user, else by the API key — never by IP", () => {
		expect(exportCallerKey(userActor("user-1"))).toBe("user:user-1");
		expect(exportCallerKey(apiKeyActor("key-1", "org-1"))).toBe("api-key:key-1");
		expect(() => exportCallerKey(anonymousActor())).toThrow(AnalyticsExportCallerMissingError);
	});
});

describe("AnalyticsExportRateLimitGuard", () => {
	it(`allows ${String(ANALYTICS_EXPORT_RATE_LIMIT)} exports per window per user, then answers 429 with Retry-After`, async () => {
		const guard = new AnalyticsExportRateLimitGuard(limiter(), new FixedActorResolver(userActor("user-1")));
		const context = await httpContext();

		for (let attempt = 0; attempt < ANALYTICS_EXPORT_RATE_LIMIT; attempt += 1) {
			await expect(guard.canActivate(context)).resolves.toBe(true);
		}
		const refused = guard.canActivate(context);
		await expect(refused).rejects.toBeInstanceOf(AnalyticsExportRateLimitedError);
		await expect(refused).rejects.toMatchObject({
			code: "ANALYTICS_EXPORT_RATE_LIMITED",
			details: { retryAfterSeconds: Math.ceil((ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS - ELAPSED_IN_WINDOW_MS) / MS_PER_SECOND) },
		});
	});

	it("counts each user separately", async () => {
		const shared = limiter();
		const busy = new AnalyticsExportRateLimitGuard(shared, new FixedActorResolver(userActor("busy")));
		for (let attempt = 0; attempt < ANALYTICS_EXPORT_RATE_LIMIT; attempt += 1) {
			await busy.canActivate(await httpContext());
		}
		await expect(busy.canActivate(await httpContext())).rejects.toBeInstanceOf(AnalyticsExportRateLimitedError);
		const guard = new AnalyticsExportRateLimitGuard(shared, new FixedActorResolver(userActor("other")));

		await expect(guard.canActivate(await httpContext())).resolves.toBe(true);
	});

	it("refuses a caller that is neither a user nor an API key before counting anything", async () => {
		const shared = limiter();
		const consume = vi.spyOn(shared, "consume");
		const guard = new AnalyticsExportRateLimitGuard(shared, new FixedActorResolver(anonymousActor()));

		await expect(guard.canActivate(await httpContext())).rejects.toBeInstanceOf(AnalyticsExportCallerMissingError);
		expect(consume).not.toHaveBeenCalled();
	});
});
