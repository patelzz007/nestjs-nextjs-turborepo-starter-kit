import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler, Logger } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { type Observable, tap } from "rxjs";

/**
 * Performance monitoring interceptor that tracks API response times.
 *
 * Logs slow requests (>1000ms) and provides metrics for monitoring.
 * This interceptor is lightweight and doesn't affect performance.
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
	private readonly logger: Logger = new Logger(PerformanceInterceptor.name);
	private readonly slowRequestThreshold: number = 1000;

	public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const startTime: number = Date.now();
		const method: string = request.method;
		const url: string = request.url;

		return next.handle().pipe(
			tap({
				next: (): void => {
					const duration: number = Date.now() - startTime;
					if (duration > this.slowRequestThreshold) {
						this.logger.warn(`Slow request: ${method} ${url} took ${String(duration)}ms`);
					}
				},
				error: (error: Error): void => {
					const duration: number = Date.now() - startTime;
					this.logger.error(`Failed request: ${method} ${url} took ${String(duration)}ms`, error.stack);
				},
			}),
		);
	}
}
