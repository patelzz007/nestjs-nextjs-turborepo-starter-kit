import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler, Logger } from "@nestjs/common";
import { SSE_METADATA } from "@nestjs/common/constants.js";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { type Observable, tap } from "rxjs";

/** A request slower than this is logged as slow. */
export const SLOW_REQUEST_THRESHOLD_MS = 1000;

/**
 * Performance monitoring interceptor that tracks API response times.
 *
 * Logs slow requests (> {@link SLOW_REQUEST_THRESHOLD_MS}) once, when their response is produced.
 * Event streams (`@Sse()` routes, `text/event-stream` requests) are not timed: they stay open for as long
 * as the client listens, by design, so their "duration" is a session length, not a slow response, and every
 * frame would otherwise be reported as one.
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
	private readonly logger: Logger = new Logger(PerformanceInterceptor.name);

	public constructor(private readonly reflector: Reflector) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		if (this.isEventStream(context, request)) {
			return next.handle();
		}
		const startTime: number = Date.now();
		const method: string = request.method;
		const url: string = request.url;

		return next.handle().pipe(
			tap({
				next: (): void => {
					const duration: number = Date.now() - startTime;
					if (duration > SLOW_REQUEST_THRESHOLD_MS) {
						this.logger.warn(`Slow request: ${method} ${url} took ${String(duration)}ms`);
					}
				},
			}),
		);
	}

	/** The same test the response interceptor uses: an `@Sse()` handler, or a client asking for an event stream. */
	private isEventStream(context: ExecutionContext, request: FastifyRequest): boolean {
		// `includes` (not strict equality) tolerates `text/event-stream, */*` and Accept parameters.
		return request.headers.accept?.includes("text/event-stream") === true || this.reflector.get<boolean | undefined>(SSE_METADATA, context.getHandler()) === true;
	}
}
