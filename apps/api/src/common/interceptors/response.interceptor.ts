import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { SSE_METADATA } from "@nestjs/common/constants.js";
import { Reflector } from "@nestjs/core";
import { nowEpochMs, type ApiPaginatedMeta, type ApiResponseMeta, type DataValue, type PaginatedServiceResult } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { throwError, type Observable } from "rxjs";
import { map } from "rxjs/operators";

import { RequestContextService } from "../context/request-context";
import { getResponseContract, type RouteResponseContract } from "../decorators/zod-response.decorators";
import { SKIP_ENVELOPE } from "../decorators/skip-envelope.decorator";
import { MissingResponseContractError, ResponseContractViolationError } from "../errors/response-contract.error";

/** The single success envelope — `{ success, data, meta }`. */
interface SingleEnvelope {
	readonly success: true;
	readonly data: DataValue;
	readonly meta: ApiResponseMeta;
}

/** The paginated success envelope — `{ success, data: items, meta: { …pagination } }`. */
interface PaginatedEnvelope {
	readonly success: true;
	readonly data: readonly DataValue[];
	readonly meta: ApiPaginatedMeta;
}

/** What this interceptor sends: one of the two envelopes, or a raw body (`@ZodRawResponse`). */
type ResponseBody = SingleEnvelope | PaginatedEnvelope | DataValue;

/**
 * Turns every handler result into the wire body its RESPONSE CONTRACT
 * declares (ADR 022, `common/decorators/zod-response.decorators.ts`):
 *
 * ```json
 * { "success": true, "data": { … }, "meta": { "correlationId": "…", "timestamp": 1790812800000 } }
 * { "success": true, "data": [ … ], "meta": { "limit": 20, "total": 100, "page": 1, "totalPages": 5,
 *   "nextCursor": null, "hasNext": true, "hasPrevious": false, "correlationId": "…", "timestamp": … } }
 * ```
 *
 * The result is parsed ONCE with the contract's schema: unknown keys are
 * stripped (an internal field never reaches the wire) and a mismatch throws
 * `ResponseContractViolationError` — the global exception filter logs it and
 * answers `500 INTERNAL_ERROR`. A JSON route WITHOUT a contract fails the same
 * way before its handler runs (`MissingResponseContractError`); the OpenAPI
 * e2e test keeps that from ever shipping.
 *
 * Pass-through (no contract, no envelope): `@Sse()` routes and
 * `text/event-stream` requests (frames are written to the socket directly) and
 * `@SkipEnvelope()` routes that write their own reply (binary downloads).
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
	public constructor(
		private readonly reflector: Reflector,
		private readonly requestContext: RequestContextService,
	) {}

	public intercept(context: ExecutionContext, next: CallHandler<DataValue>): Observable<ResponseBody> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		// `includes` (not strict equality) tolerates `text/event-stream, */*` and Accept parameters.
		const acceptHeader: string | undefined = request.headers.accept;
		if (acceptHeader?.includes("text/event-stream") === true || this.reflector.get<boolean | undefined>(SSE_METADATA, context.getHandler()) === true) {
			return next.handle();
		}
		if (this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE, [context.getHandler(), context.getClass()])) {
			return next.handle();
		}

		const route = `${context.getClass().name}.${context.getHandler().name}`;
		const contract: RouteResponseContract | undefined = getResponseContract(context.getHandler());
		if (contract === undefined) {
			return throwError(() => new MissingResponseContractError(route));
		}
		const correlationId: string = this.requestContext.resolveCorrelationId(request.raw);

		return next.handle().pipe(map((result: DataValue): ResponseBody => ResponseInterceptor.toBody(contract, result, route, correlationId)));
	}

	/** Parse `result` with the contract (single pass) and wrap it in the declared envelope. */
	public static toBody(contract: RouteResponseContract, result: DataValue, route: string, correlationId: string): ResponseBody {
		if (contract.kind === "paginated") {
			const page = contract.page.safeParse(result);
			if (!page.success) {
				throw new ResponseContractViolationError(route, page.error);
			}
			return ResponseInterceptor.paginatedEnvelope(page.data, correlationId);
		}
		const parsed = contract.schema.safeParse(result);
		if (!parsed.success) {
			throw new ResponseContractViolationError(route, parsed.error);
		}
		if (contract.kind === "raw") {
			return parsed.data;
		}
		return { success: true, data: parsed.data, meta: { correlationId, timestamp: nowEpochMs() } };
	}

	private static paginatedEnvelope(page: PaginatedServiceResult, correlationId: string): PaginatedEnvelope {
		const { items, limit, total, page: pageNumber, totalPages, nextCursor, hasNext, hasPrevious } = page;
		return {
			success: true,
			data: items,
			meta: { limit, total, page: pageNumber, totalPages, nextCursor, hasNext, hasPrevious, correlationId, timestamp: nowEpochMs() },
		};
	}
}
