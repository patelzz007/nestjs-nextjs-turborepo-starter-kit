import { CallHandler, ExecutionContext, HttpException, Inject, Injectable, type NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { type Observable, tap } from "rxjs";
import { z } from "zod";

import { TelescopeJsonValueSchema, type ExceptionLogEntry, type RequestLogEntry, type TelescopeJsonValue, type TelescopeOptions } from "@workspace/shared";

import type { AccessTokenPayload } from "../auth/services/token.service";

import { RequestSpanContext, type SpanStore } from "./request-span-context.js";
import { sanitizeHeaders, sanitizeJson, truncateJson } from "./sanitize.js";
import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js";

interface CapturedError {
	readonly name: string;
	readonly message: string;
	readonly statusCode: number;
	readonly stack: string | null;
}

/**
 * The response-side half of the capture pipeline:
 * - measures the handler (controller → services) and records it as a span,
 * - catches errors the same way the `ResponseInterceptor` does, recording an
 *   `ExceptionLog` entry (grouped by an errorGroup hash),
 * - on completion writes the `RequestLog` entry into the store.
 *
 * Registered as an `APP_INTERCEPTOR` AFTER the `ResponseInterceptor`, so it
 * sees the raw controller output and the raw error (pre-envelope).
 */
@Injectable()
export class TelescopeInterceptor implements NestInterceptor {
	public constructor(
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
		@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions,
		private readonly eventBus: TelescopeEventBus,
	) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<TelescopeJsonValue> {
		const request: Request = context.switchToHttp().getRequest<Request>();
		const spanStore: SpanStore | undefined = RequestSpanContext.getStore();
		if (!spanStore?.captured) {
			return next.handle();
		}

		const handlerStart: number = performance.now();
		let rawResponse: TelescopeJsonValue | undefined;
		let errorInfo: CapturedError | undefined;

		// Span 0 is the pre-handler phase (guards + body parsing + pipes) —
		// its duration is patched in finalize once the handler has finished.
		spanStore.spans.push({
			name: "guards & middleware",
			kind: "guard",
			startOffsetMs: Math.round(handlerStart - spanStore.startedAt),
			durationMs: 0,
		});

		return next.handle().pipe(
			tap({
				// Typed like the repo's ResponseInterceptor (`map((data: JsonValue))`):
				// the schema check below is the runtime guard for non-JSON payloads.
				next: (data: TelescopeJsonValue): void => {
					const parsed = TelescopeJsonValueSchema.safeParse(data);
					if (parsed.success) {
						rawResponse = parsed.data;
					}
				},
				error: (err: Error): void => {
					errorInfo = this.toCapturedError(err);
				},
			}),
			tap({
				finalize: (): void => {
					this.finalize(request, spanStore, rawResponse, errorInfo, handlerStart);
				},
			}),
		);
	}

	private toCapturedError(err: Error): CapturedError {
		const statusCode: number = err instanceof HttpException ? err.getStatus() : 500;
		return { name: err.name, message: err.message, statusCode, stack: err.stack ?? null };
	}

	/** Builds and writes the RequestLog entry (+ exception entry on error). */
	private finalize(request: Request, spanStore: SpanStore, rawResponse: TelescopeJsonValue | undefined, errorInfo: CapturedError | undefined, handlerStart: number): void {
		const now: number = performance.now();
		const durationMs: number = Math.round(now - spanStore.startedAt);

		// Patch span 0 (guards & middleware) with its real duration — the span
		// was pushed unconditionally above, so the length guard is the contract.
		if (spanStore.spans.length > 0) {
			spanStore.spans[0].durationMs = Math.round(now - handlerStart);
		}
		spanStore.spans.push({ name: "serialization", kind: "serialization", startOffsetMs: durationMs, durationMs: 0 });

		// Improvement 10: the body serialization budget is configurable
		// (`TELESCOPE_BODY_LIMIT_CHARS`) instead of a hardcoded constant.
		const responseBody: TelescopeJsonValue | null = rawResponse !== undefined ? truncateJson(sanitizeJson(rawResponse), this.options.maxBodyChars) : null;
		const requestBody: TelescopeJsonValue | null = spanStore.requestBody !== null ? truncateJson(sanitizeJson(spanStore.requestBody), this.options.maxBodyChars) : null;

		const entry: RequestLogEntry = {
			id: nanoid(),
			correlationId: spanStore.correlationId,
			method: request.method,
			path: request.path,
			queryString: this.readQueryString(request),
			statusCode: errorInfo !== undefined ? errorInfo.statusCode : (request.res?.statusCode ?? 200),
			durationMs,
			ip: request.ip ?? null,
			userAgent: this.readUserAgent(request),
			userId: this.readUserId(request),
			requestBody,
			responseBody,
			requestHeaders: sanitizeHeaders(request.headers, this.options.captureHeaders),
			spans: [...spanStore.spans],
			// Improvement 16: console output that ran inside this request.
			logs: [...spanStore.logs],
			createdAt: new Date().toISOString(),
		};

		if (errorInfo !== undefined) {
			this.store.pushException(this.toExceptionEntry(entry, errorInfo));
			// Improvement 2: push an exception event so live dashboards update.
			this.eventBus.publish({
				type: "exception",
				id: entry.correlationId,
				name: errorInfo.name,
				message: errorInfo.message,
				statusCode: errorInfo.statusCode,
			});
		}
		this.store.pushRequest(entry);
		// Improvement 2: push a request event so live dashboards update.
		this.eventBus.publish({
			type: "request",
			id: entry.id,
			method: entry.method,
			path: entry.path,
			statusCode: entry.statusCode,
			durationMs: entry.durationMs,
		});
	}

	/** AuthGuard attaches the JWT payload to `request.user` before finalize. */
	private readUserId(request: Request): string | null {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Express' Request type does not model AuthGuard's `user` attachment; the shape is the documented AccessTokenPayload.
		const user: AccessTokenPayload | undefined = (request as { user?: AccessTokenPayload }).user;
		return user?.sub ?? null;
	}

	private readQueryString(request: Request): string | null {
		const index: number = request.originalUrl.indexOf("?");
		return index >= 0 ? request.originalUrl.slice(index + 1) : null;
	}

	private readUserAgent(request: Request): string | null {
		const raw: string | string[] | undefined = request.headers["user-agent"];
		const parsed = z.string().safeParse(raw);
		return parsed.success ? parsed.data : null;
	}

	private toExceptionEntry(requestEntry: RequestLogEntry, errorInfo: CapturedError): ExceptionLogEntry {
		const firstFrame: string = errorInfo.stack !== null ? errorInfo.stack.split("\n").slice(1, 2).join("") : "";
		const errorGroup: string = createHash("sha256").update(`${errorInfo.name}:${errorInfo.message}:${firstFrame}`).digest("hex").slice(0, 16);

		const nowIso: string = new Date().toISOString();
		return {
			id: nanoid(),
			correlationId: requestEntry.correlationId,
			errorGroup,
			name: errorInfo.name,
			message: errorInfo.message,
			stack: errorInfo.stack,
			statusCode: errorInfo.statusCode,
			path: requestEntry.path,
			method: requestEntry.method,
			userId: requestEntry.userId,
			occurrences: 1,
			createdAt: nowIso,
			// Improvement 15: first/last seen are filled at the boundary; the
			// store bumps lastSeenAt + occurrences on repeats of the same group.
			firstSeenAt: nowIso,
			lastSeenAt: nowIso,
		};
	}
}
