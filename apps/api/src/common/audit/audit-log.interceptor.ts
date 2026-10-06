import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { HTTP_CODE_METADATA, SSE_METADATA } from "@nestjs/common/constants.js";
import { Reflector } from "@nestjs/core";
import type { DataValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { concatMap, from, map, Observable } from "rxjs";

import { AuditTrailService } from "./audit-trail.service";
import { defaultSuccessStatus, isAuditedRoute } from "./http-audit-entry";

/**
 * Global audit interceptor (rules/10 → "Audit logging"): every successful
 * request — reads included; health probes exempt — gets its `audit_logs` row here, AFTER the response
 * contract was applied (it runs outside `ResponseInterceptor`, so it records
 * the exact wire body). The response is only released once the row is
 * written; a write failure turns the response into a 500
 * (`AuditLogWriteError`). Failures — including guard rejections that never
 * reach this interceptor — are recorded by `GlobalExceptionFilter`.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor<DataValue, DataValue> {
	public constructor(
		private readonly reflector: Reflector,
		private readonly auditTrail: AuditTrailService,
	) {}

	public intercept(context: ExecutionContext, next: CallHandler<DataValue>): Observable<DataValue> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		// An SSE stream has no single response to record (its errors still reach the exception filter).
		if (this.reflector.get<boolean | undefined>(SSE_METADATA, context.getHandler()) === true || !isAuditedRoute(request.routeOptions.url)) {
			return next.handle();
		}
		const successStatus: number = this.reflector.get<number | undefined>(HTTP_CODE_METADATA, context.getHandler()) ?? defaultSuccessStatus(request.method);
		return new Observable<DataValue>((subscriber) =>
			this.auditTrail.runInScope({ request, successStatus }, () =>
				next
					.handle()
					.pipe(
						concatMap((result: DataValue): Observable<DataValue> => from(this.auditTrail.recordSuccess(request, successStatus, result)).pipe(map((): DataValue => result))),
					)
					.subscribe(subscriber),
			),
		);
	}
}
