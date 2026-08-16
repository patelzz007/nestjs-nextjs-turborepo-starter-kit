import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";

import type { TelescopeOptions } from "@workspace/shared";

import type { RequestWithTrace } from "../../common/middleware/correlation-id.middleware";

import { RequestSpanContext, type SpanStore } from "./request-span-context";
import { shouldCaptureRequest } from "./should-capture";
import { TELESCOPE_OPTIONS } from "./telescope.options";

/**
 * The raw Node request seen by this middleware on the Fastify adapter (middie
 * runs Nest middleware on `request.raw` at the `onRequest` phase). `body` is
 * NOT parsed at that phase — the parsed body is captured by the
 * `TelescopeInterceptor` (which runs after parsing) instead.
 */
type RawCaptureRequest = IncomingMessage & RequestWithTrace & { originalUrl: string };

/**
 * Opens the AsyncLocalStorage scope for every capturable request: snapshots
 * the correlation id + start time, applies the sampling decision, and holds
 * the (sanitized) request body for the interceptor. Everything downstream —
 * guards, interceptors, services, Prisma query events — runs inside this
 * scope, so `RequestSpanContext.span()` and the Prisma listener find it.
 *
 * Registered AFTER `CorrelationIdMiddleware` so `req.correlationId` exists.
 *
 * On the Fastify adapter this middleware runs at `onRequest` — BEFORE body
 * parsing — so `req.body` is not available here. The parsed body is stored
 * into the span store by a `preHandler` hook (registered in TelescopeModule)
 * when `captureBody === "full"`, which is before the interceptor finalizes.
 */
@Injectable()
export class TelescopeCaptureMiddleware implements NestMiddleware {
	public constructor(@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions) {}

	public use(req: RawCaptureRequest, res: ServerResponse, next: () => void): void {
		const options: TelescopeOptions = this.options;
		// NOTE: inside a router-level Nest middleware, `req.url` is the
		// mount-relative path — middie patches `originalUrl` to the full path,
		// which is what the ignore/capture prefixes compare against.
		const queryIndex: number = req.originalUrl.indexOf("?");
		const pathname: string = queryIndex >= 0 ? req.originalUrl.slice(0, queryIndex) : req.originalUrl;

		if (
			!options.enabled ||
			!shouldCaptureRequest(req.method ?? "GET", pathname, { ignorePaths: options.ignorePaths, redactPaths: options.redactPaths, capturePaths: options.capturePaths })
		) {
			next();
			return;
		}

		const correlationId: string = req.correlationId ?? nanoid();
		const captured: boolean = Math.random() < options.sampling.dev;

		const store: SpanStore = {
			correlationId,
			startedAt: performance.now(),
			spans: [],
			captured,
			userId: null,
			// Body is not parsed at onRequest (Fastify parses at preParsing); the
			// interceptor fills this in for captureBody=full, before finalize.
			requestBody: null,
			// Improvement 16: per-request console log buffer.
			logs: [],
			// Feature 5: cache ops recorded by TelescopeCacheTracer.
			cacheOps: [],
		};

		// next() starts the whole downstream chain inside the ALS scope, so the
		// async continuation (interceptor finalize, query events) keeps it.
		RequestSpanContext.storage.run(store, (): void => {
			next();
		});
	}
}
