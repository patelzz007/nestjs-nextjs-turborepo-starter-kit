import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
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
		if (!options.enabled || !shouldCaptureRequest(req.method, req.path, options.ignorePaths)) {
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
 */
function toJsonValue(body: unknown): TelescopeJsonValue | null {
	if (body === undefined || body === null) {
		return null;
	}
	const direct = TelescopeJsonValueSchema.safeParse(body);
	if (direct.success) {
		return direct.data;
	}
	try {
		const reparsed = TelescopeJsonValueSchema.safeParse(JSON.parse(String(body)));
		return reparsed.success ? reparsed.data : String(body);
	} catch {
		return String(body);
	}
}
