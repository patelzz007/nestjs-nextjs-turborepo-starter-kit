import { CallHandler, ExecutionContext, HttpException, Injectable, type NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { type Observable, tap } from "rxjs";
import { z } from "zod";

import { TelescopeJsonValueSchema, type ExceptionLogEntry, type RequestLogEntry, type TelescopeJsonValue, type TelescopeOptions } from "@workspace/shared";

import type { AccessTokenPayload } from "../auth/services/token.service";

import { RequestSpanContext, type SpanStore } from "./request-span-context.js";
import { sanitizeHeaders, sanitizeJson, truncateJson } from "./sanitize.js";
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
		private readonly store: TelescopeStore,
		private readonly options: TelescopeOptions,
	) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request: Request = context.switchToHttp().getRequest<Request>();
		const spanStore: SpanStore | undefined = RequestSpanContext.getStore();
		if (spanStore === undefined || !spanStore.captured) {
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
				next: (data: unknown): void => {
					const parsed = TelescopeJsonValueSchema.safeParse(data);
					if (parsed.success) {
						rawResponse = parsed.data;
					}
				},
				error: (err: unknown): void => {
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

	private toCapturedError(err: unknown): CapturedError {
		const name: string = err instanceof Error ? err.name : "Error";
		const message: string = err instanceof Error ? err.message : String(err);
		const statusCode: number = err instanceof HttpException ? err.getStatus() : 500;
		const stack: string | null = err instanceof Error && err.stack !== undefined ? err.stack : null;
		return { name, message, statusCode, stack };
	}

	/** Builds and writes the RequestLog entry (+ exception entry on error). */
	private finalize(
		request: Request,
		spanStore: SpanStore,
		rawResponse: TelescopeJsonValue | undefined,
		errorInfo: CapturedError | undefined,
		handlerStart: number,
	): void {
		const now: number = performance.now();
		const durationMs: number = Math.round(now - spanStore.startedAt);

		// Patch span 0 (guards & middleware) with its real duration.
		const guardSpan = spanStore.spans[0];
		if (guardSpan !== undefined) {
			guardSpan.durationMs = Math.round(now - handlerStart);
		}
		spanStore.spans.push({ name: "serialization", kind: "serialization", startOffsetMs: durationMs, durationMs: 0 });

		const responseBody: TelescopeJsonValue | null = rawResponse !== undefined ? truncateJson(sanitizeJson(rawResponse)) : null;
		const requestBody: TelescopeJsonValue | null = spanStore.requestBody !== null ? truncateJson(sanitizeJson(spanStore.requestBody)) : null;

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
			createdAt: new Date().toISOString(),
		};

		if (errorInfo !== undefined) {
			this.store.pushException(this.toExceptionEntry(entry, errorInfo));
		}
		this.store.pushRequest(entry);
	}

	/** AuthGuard attaches the JWT payload to `request.user` before finalize. */
	private readUserId(request: Request): string | null {
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
			createdAt: new Date().toISOString(),
		};
	}
}
