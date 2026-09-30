import { Injectable, NestInterceptor, type CallHandler, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { type Observable } from "rxjs";

import { CorrelationContextService } from "./correlation-context.service";

/** Mirrors Fastify correlation id into {@link CorrelationContextService} for downstream services. */
@Injectable()
export class CorrelationContextInterceptor implements NestInterceptor {
	public constructor(private readonly correlationContext: CorrelationContextService) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const correlationId = request.correlationId;
		return this.correlationContext.run(correlationId, () => next.handle());
	}
}
