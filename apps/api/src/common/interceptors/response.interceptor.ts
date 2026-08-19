import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler, HttpException, HttpStatus } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { type Observable, throwError } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { ApiResponseShapeSchema, PaginatedServiceResultSchema, nowEpochMs, type ApiResponseShape, type DataValue, type PaginatedServiceResult } from "@workspace/shared";

/**
 * Zod schema for a PaginatedResult shape (from paginate()).
 */
const PaginatedResultSchema = PaginatedServiceResultSchema;

/** Narrow controller data to a paginated service result. */
function parsePaginated(value: DataValue): PaginatedServiceResult | null {
	const parsed = PaginatedResultSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/** Narrow controller data to an already-wrapped API response. */
function parseApiResponse(value: DataValue): ApiResponseShape | null {
	const parsed = ApiResponseShapeSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
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
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		// ── SSE routes pass through untouched ──────────────────────────────
		// The `@Sse()` adapter writes each frame (`data: …`) directly to the
		// wire. Wrapping every frame in the `{ success, data, meta }` envelope
		// would corrupt the stream (each frame would become a nested envelope),
		// so `text/event-stream` requests bypass the wrapper entirely. The
		// global AuthGuard still applies — the stream stays admin-only.
		// `includes` (not strict equality) tolerates clients that send
		// `text/event-stream, */*` or other Accept parameters.
		const acceptHeader: string | undefined = request.headers.accept;
		if (acceptHeader?.includes("text/event-stream")) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- CallHandler defaults to `any`; SSE bypass passes the raw stream through.
			return next.handle();
		}
		const correlationId: string = request.correlationId ?? "";

		// CallHandler defaults to `any` — the map callback narrows to `object`.
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- NestJS CallHandler has no generic override; this is the narrowest safe cast.
		return (next.handle() as Observable<DataValue>).pipe(
			map((data: DataValue): object => {
				const paginated: PaginatedServiceResult | null = parsePaginated(data);
				if (paginated !== null) {
					const { items, total, page, limit, totalPages, hasNext, hasPrevious } = paginated;

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
							timestamp: nowEpochMs(),
						},
					};

					request.responseData = wrapped;
					return wrapped;
				}

				const apiResponse: ApiResponseShape | null = parseApiResponse(data);
				if (apiResponse !== null) {
					const { meta } = apiResponse;

					const wrapped = {
						...apiResponse,
						meta: {
							...meta,
							correlationId,
							timestamp: nowEpochMs(),
						},
					};

					request.responseData = wrapped;
					return wrapped;
				}

				// ── Case 3: Plain data → standard success envelope ──
				const wrapped = {
					success: true,
					data,
					meta: {
						correlationId,
						timestamp: nowEpochMs(),
					},
				};

				request.responseData = wrapped;
				return wrapped;
			}),
			// ── Catch errors so error responses are also displayed in terminal ──
			catchError((err: Error) => {
				const statusCode: number = err instanceof HttpException ? err.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

				request.responseData = {
					success: false,
					error: {
						message: err.message,
						statusCode,
					},
					meta: {
						correlationId,
						timestamp: nowEpochMs(),
					},
				};

				return throwError(() => err);
			}),
		);
	}
}
