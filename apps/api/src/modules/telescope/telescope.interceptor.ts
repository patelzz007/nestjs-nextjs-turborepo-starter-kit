import { CallHandler, ExecutionContext, HttpException, Inject, Injectable, type NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { type Observable, tap } from "rxjs";
import { z } from "zod";

import {
	TelescopeJsonValueSchema,
	TelescopePiiCategorySchema,
	type ExceptionLogEntry,
	type RequestLogEntry,
	type TelescopeEnvironment,
	type TelescopeJsonValue,
	type TelescopeOptions,
	type TelescopePiiCategory,
	type TelescopePiiFlag,
	type TelescopeSpan,
} from "@workspace/shared";

import type { AccessTokenPayload } from "../auth/services/token.service";

import { redactPii, redactPiiHeaders, scanPii, scanPiiHeaders } from "./pii-scanner.js";
import { RequestSpanContext, type SpanStore } from "./request-span-context.js";
import { sanitizeHeaders, sanitizeJson, truncateJson } from "./sanitize.js";
import { TelescopeAlertService } from "./telescope-alert.service.js";
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
		private readonly alertService: TelescopeAlertService,
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

	/** Improvement 14 — keep bookends + longest spans under the configured cap. */
	private capSpans(spans: TelescopeSpan[], cap: number): TelescopeSpan[] {
		if (spans.length <= cap) {
			return spans;
		}
		const bookendCount: number = Math.min(3, spans.length);
		const bookends: TelescopeSpan[] = spans.slice(0, bookendCount);
		const middle: TelescopeSpan[] = spans
			.slice(bookendCount, -bookendCount)
			.sort((a: TelescopeSpan, b: TelescopeSpan): number => b.durationMs - a.durationMs)
			.slice(0, Math.max(0, cap - bookendCount));
		return [...bookends, ...middle];
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
			spanStore.spans[0].durationMs = Math.round(handlerStart - spanStore.startedAt);
		}
		// Feature 6 — a dedicated handler span (controller execution) with the
		// resolved route params captured alongside it.
		spanStore.spans.push({
			name: "handler",
			kind: "service",
			startOffsetMs: Math.round(handlerStart - spanStore.startedAt),
			durationMs: Math.round(now - handlerStart),
		});
		spanStore.spans.push({ name: "serialization", kind: "serialization", startOffsetMs: durationMs, durationMs: 0 });

		// Improvement 14 — span budget cap: keep the bookend spans (guards &
		// middleware, handler, serialization) and the longest N-3 in between, so
		// a pathological request (thousands of queries) can't blow the buffer.
		// The SpanStore reference is read-only; replace the array contents in place.
		const cappedSpans = this.capSpans(spanStore.spans, this.options.maxSpansPerRequest);
		spanStore.spans.length = 0;
		spanStore.spans.push(...cappedSpans);

		// Feature 17 — PII scan + redact BEFORE truncation: flags are counted on
		// the sanitized value, then phone/JWT/SSN/card patterns are masked by
		// default (the sanitizer already masks emails + secret keys).
		const sanitizedResponse: TelescopeJsonValue | null = rawResponse !== undefined ? sanitizeJson(rawResponse) : null;
		const sanitizedRequest: TelescopeJsonValue | null = spanStore.requestBody !== null ? sanitizeJson(spanStore.requestBody) : null;
		const sanitizedHeaders: Record<string, string> | null = sanitizeHeaders(request.headers, this.options.captureHeaders);

		const piiFlags: readonly TelescopePiiFlag[] = this.mergePiiFlags(scanPii(sanitizedRequest), scanPii(sanitizedResponse), scanPiiHeaders(sanitizedHeaders));

		// Improvement 15 — PII mode: "redact" masks values (default), "flag"
		// keeps the payload untouched and only records the categories found.
		const shouldRedact: boolean = this.options.piiMode === "redact";
		const responseBody: TelescopeJsonValue | null =
			sanitizedResponse !== null ? truncateJson(shouldRedact ? redactPii(sanitizedResponse) : sanitizedResponse, this.options.maxBodyChars) : null;
		const requestBody: TelescopeJsonValue | null =
			sanitizedRequest !== null ? truncateJson(shouldRedact ? redactPii(sanitizedRequest) : sanitizedRequest, this.options.maxBodyChars) : null;

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
			requestHeaders: redactPiiHeaders(sanitizedHeaders),
			spans: [...spanStore.spans],
			// Improvement 16: console output that ran inside this request.
			logs: [...spanStore.logs],
			// Feature 8: environment tag (NODE_ENV + host) for multi-env filters.
			environment: this.readEnvironment(),
			// Feature 6: resolved route params (e.g. { id: "abc" }) from Express.
			handlerParams: this.readHandlerParams(request),
			// Feature 5: cache ops recorded by TelescopeCacheTracer.
			cacheOps: [...spanStore.cacheOps],
			// Feature 17: PII categories found + redacted.
			piiFlags: [...piiFlags],
			// Feature 14: new requests start unstarred (annotation lives in the store).
			starred: false,
			// Improvement 4: N+1 warnings are computed lazily on the SQL endpoint; the
			// summary column is populated by the store on first detect.
			n1WarningCount: 0,
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
		// Feature 18 — threshold alerts (webhook + in-app list).
		this.alertService.evaluate(entry);
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

	/** Feature 8 — the process environment tag captured once per request. */
	private readEnvironment(): TelescopeEnvironment {
		return {
			nodeEnv: process.env.NODE_ENV ?? "development",
			host: hostname(),
		};
	}

	/** Feature 6 — resolved Express route params, values length-capped. */
	private readHandlerParams(request: Request): Record<string, string> | null {
		const rawParams: Readonly<Record<string, string | string[]>> = { ...request.params };
		const keys: readonly string[] = Object.keys(rawParams);
		if (keys.length === 0) {
			return null;
		}
		const params: Record<string, string> = {};
		for (const key of keys) {
			// Express types params as string | string[]; route params are always
			// single strings, arrays are ignored defensively.
			const rawValue: string | string[] = rawParams[key] ?? "";
			const value: string = typeof rawValue === "string" ? rawValue : (rawValue[0] ?? "");
			params[key] = value.length > 100 ? `${value.slice(0, 97)}…` : value;
		}
		return params;
	}

	/** Feature 17 — merge per-source PII flag lists, summing shared categories. */
	private mergePiiFlags(...sources: readonly (readonly TelescopePiiFlag[])[]): readonly TelescopePiiFlag[] {
		const totals = new Map<TelescopePiiCategory, number>();
		for (const source of sources) {
			for (const flag of source) {
				const category: TelescopePiiCategory = TelescopePiiCategorySchema.parse(flag.category);
				totals.set(category, (totals.get(category) ?? 0) + flag.count);
			}
		}
		return [...totals.entries()]
			.map(([category, count]) => ({ category, count }))
			.sort((a: TelescopePiiFlag, b: TelescopePiiFlag): number => a.category.localeCompare(b.category));
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
			// Improvement 6: new groups start open; the store re-opens resolved/
			// ignored groups when the same error recurs.
			status: "open",
		};
	}
}
