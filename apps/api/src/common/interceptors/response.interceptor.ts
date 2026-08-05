import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler, HttpException, HttpStatus } from "@nestjs/common";
import type { Request } from "express";
import { type Observable, throwError } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { z } from "zod";

import type { JsonValue } from "../../types/json.js";
import type { RequestWithTrace } from "../middleware/correlation-id.middleware.js";

/**
 * Zod schema for a PaginatedResult shape (from paginate()).
 * All pagination fields except items/total/page/limit are optional
 * since the interceptor should gracefully handle partial matches.
 */
const PaginatedResultSchema = z.object({
	items: z.array(z.custom<JsonValue>()),
	total: z.number(),
	page: z.number(),
	limit: z.number(),
	totalPages: z.number().optional(),
	hasNext: z.boolean().optional(),
	hasPrevious: z.boolean().optional(),
});

/** Type guard — narrows data to the paginated shape after Zod validation. */
function isPaginated(value: JsonValue): value is z.infer<typeof PaginatedResultSchema> {
	return PaginatedResultSchema.safeParse(value).success;
}

/**
 * Zod schema for an already-wrapped ApiResponse shape.
 * Matches objects that have a `success` boolean and a `meta` record.
 */
const ApiResponseSchema = z.object({
	success: z.boolean(),
	meta: z.record(z.string(), z.custom<JsonValue>()),
});

/** Type guard — narrows data to the ApiResponse shape after Zod validation. */
function isApiResponse(value: JsonValue): value is z.infer<typeof ApiResponseSchema> {
	return ApiResponseSchema.safeParse(value).success;
}

/**
 * Standard response envelope for all API responses.
 *
 * The interceptor wraps every controller response in a consistent structure:
 * ```json
 * {
 *   "success": true,
 *   "data": { ... },
 *   "meta": { "correlationId": "...", "timestamp": "..." }
 * }
 * ```
 *
 * Paginated responses get a richer meta object with pagination metadata:
 * ```json
 * {
 *   "success": true,
 *   "data": [ ... items ... ],
 *   "meta": {
 *     "total": 100,
 *     "page": 1,
 *     "limit": 20,
 *     "totalPages": 5,
 *     "hasNext": true,
 *     "hasPrevious": false,
 *     "correlationId": "...",
 *     "timestamp": "..."
 *   }
 * }
 * ```
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
	public intercept(context: ExecutionContext, next: CallHandler): Observable<object> {
		const request: Request = context.switchToHttp().getRequest<Request>();
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Runtime type: CorrelationIdMiddleware sets correlationId
		const correlationId: string = (request as RequestWithTrace).correlationId ?? "";

		return next.handle().pipe(
			map((data: JsonValue) => {
				// ── Case 1: Paginated result → flatten items into data, pagination into meta ──
				if (isPaginated(data)) {
					const { items, total, page, limit, totalPages, hasNext, hasPrevious } = data;

					const wrapped = {
						success: true,
						data: items,
						meta: {
							total,
							page,
							limit,
							totalPages: totalPages ?? null,
							hasNext: hasNext ?? null,
							hasPrevious: hasPrevious ?? null,
							correlationId,
							timestamp: new Date().toISOString(),
						},
					};

					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Runtime type: CorrelationIdMiddleware sets responseData
					(request as RequestWithTrace).responseData = wrapped;
					return wrapped;
				}

				// ── Case 2: Already an ApiResponse-like shape (has success + meta) ──
				if (isApiResponse(data)) {
					const { meta } = data;

					const wrapped = {
						...data,
						meta: {
							...meta,
							correlationId,
							timestamp: new Date().toISOString(),
						},
					};

					(request satisfies RequestWithTrace).responseData = wrapped;
					return wrapped;
				}

				// ── Case 3: Plain data → standard success envelope ──
				const wrapped = {
					success: true,
					data,
					meta: {
						correlationId,
						timestamp: new Date().toISOString(),
					},
				};

				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Runtime type: CorrelationIdMiddleware sets responseData
				(request as RequestWithTrace).responseData = wrapped;
				return wrapped;
			}),
			// ── Catch errors so error responses are also displayed in terminal ──
			catchError((err: Error) => {
				const statusCode: number = err instanceof HttpException ? err.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Runtime type: CorrelationIdMiddleware sets responseData
				(request as RequestWithTrace).responseData = {
					success: false,
					error: {
						message: err.message,
						statusCode,
					},
					meta: {
						correlationId,
						timestamp: new Date().toISOString(),
					},
				};

				return throwError(() => err);
			}),
		);
	}
}
