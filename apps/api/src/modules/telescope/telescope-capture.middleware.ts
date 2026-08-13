import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import { nanoid } from "nanoid";

import { TelescopeJsonValueSchema, type TelescopeJsonValue, type TelescopeOptions } from "@workspace/shared";

import type { RequestWithTrace } from "../../common/middleware/correlation-id.middleware.js";

import { RequestSpanContext, type SpanStore } from "./request-span-context.js";
import { shouldCaptureRequest } from "./should-capture.js";
import { TELESCOPE_OPTIONS } from "./telescope.options.js";

/**
 * Opens the AsyncLocalStorage scope for every capturable request: snapshots
 * the correlation id + start time, applies the sampling decision, and holds
 * the (sanitized) request body for the interceptor. Everything downstream —
 * guards, interceptors, services, Prisma query events — runs inside this
 * scope, so `RequestSpanContext.span()` and the Prisma listener find it.
 *
 * Registered AFTER `CorrelationIdMiddleware` so `req.correlationId` exists.
 */
@Injectable()
export class TelescopeCaptureMiddleware implements NestMiddleware {
	public constructor(@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions) {}

	public use(req: RequestWithTrace, res: Response, next: NextFunction): void {
		const options: TelescopeOptions = this.options;
		// NOTE: inside a router-level Nest middleware, `req.path` is the
		// mount-relative path (`/`) — the real path lives in `req.originalUrl`.
		// Comparing `/` against the ignore prefixes would capture EVERYTHING,
		// including `/health`, `/docs` and `/telescope/*` itself.
		const queryIndex: number = req.originalUrl.indexOf("?");
		const pathname: string = queryIndex >= 0 ? req.originalUrl.slice(0, queryIndex) : req.originalUrl;

		if (
			!options.enabled ||
			!shouldCaptureRequest(req.method, pathname, { ignorePaths: options.ignorePaths, redactPaths: options.redactPaths, capturePaths: options.capturePaths })
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
			requestBody: options.captureBody === "full" ? toJsonValue(req.body) : null,
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

/**
 * Best-effort body snapshot: `req.body` may be undefined (GET), a parsed
 * object, an array, or a raw string. One zod parse — no `typeof` guards —
 * returns a JSON-compatible value or `null`. The sanitizer runs at capture
 * time in the interceptor, so stored data is already clean (§10.2).
 *
 * Typed as the JSON value union (repo rule 2: no `unknown`/`any`); a
 * non-JSON body that slips past body-parsing is still handled by the
 * JSON.stringify fallback at runtime.
 */
function toJsonValue(body: TelescopeJsonValue | null | undefined): TelescopeJsonValue | null {
	if (body === undefined || body === null) {
		return null;
	}
	const direct = TelescopeJsonValueSchema.safeParse(body);
	if (direct.success) {
		return direct.data;
	}
	// JSON.stringify (never `String(...)`): a non-JSON body like a Buffer or
	// FormData object must serialize losslessly-ish instead of `[object Object]`.
	try {
		const serialized: string = JSON.stringify(body);
		const reparsed = TelescopeJsonValueSchema.safeParse(JSON.parse(serialized));
		return reparsed.success ? reparsed.data : serialized;
	} catch {
		return "{}";
	}
}
