import { Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiErrorCodes, ApiErrorResponseSchema, nowEpochMs, type ApiErrorResponse, type CaughtValue, type JsonValue } from "@workspace/shared";
import { z } from "zod";

import { TypedConfigService } from "../../config/typed-config.service";
import { LogService } from "../../modules/logs/logs.service";
import { RequestContextService } from "../context/request-context";
import { redactUrl } from "../logging/redaction";
import { readCaughtErrorMessage } from "../utils/caught-error";
import { AppError } from "./app-error";
import { isServerErrorStatus, STANDARD_ERROR_MESSAGES } from "./error-codes";
import { mapException, type MappedError } from "./exception-mapper";

/** `details.retryAfterSeconds` → `Retry-After` header (RFC 9110 §10.2.3). */
const RetryAfterDetailSchema = z.object({ retryAfterSeconds: z.number().int().positive() });

/** Log context for every line this filter writes. */
const LOG_CONTEXT = "GlobalExceptionFilter";

/**
 * The ONE place a thrown value becomes an HTTP error response.
 *
 * Every failure — `AppError`, Nest `HttpException` (guards, pipes, the
 * validation pipe), Prisma errors, Fastify framework errors that Nest routes
 * through its error handler, and plain bugs — is normalized by
 * {@link mapException} into:
 *
 * ```json
 * { "success": false,
 *   "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { … } },
 *   "meta": { "correlationId": "…", "timestamp": 1790812800000 } }
 * ```
 *
 * which mirrors the success envelope produced by `ResponseInterceptor`.
 * 5xx failures are logged server-side with the full error and stack plus the
 * correlation id; the client only ever sees the safe code/message.
 *
 * Registered globally via `APP_FILTER` in `AppModule`. See docs/error-model.md.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter<CaughtValue> {
	private readonly exposeInternalErrors: boolean;

	public constructor(
		private readonly httpAdapterHost: HttpAdapterHost,
		private readonly logService: LogService,
		private readonly requestContext: RequestContextService,
		config: TypedConfigService,
	) {
		this.exposeInternalErrors = config.isDevelopment;
	}

	public catch(exception: CaughtValue, host: ArgumentsHost): void {
		const http = host.switchToHttp();
		const request: FastifyRequest = http.getRequest<FastifyRequest>();
		const reply: FastifyReply = http.getResponse<FastifyReply>();
		const mapped: MappedError = mapException(exception, { exposeInternalErrors: this.exposeInternalErrors });
		// The one request context (ADR 017) — or, for failures raised before the
		// context middleware ran, the same per-request id Fastify's genReqId used.
		const correlationId: string = this.requestContext.resolveCorrelationId(request.raw);

		if (isServerErrorStatus(mapped.httpStatus)) {
			this.logServerError(exception, mapped, request, correlationId);
		}

		const envelope: ApiErrorResponse = GlobalExceptionFilter.buildEnvelope(mapped, correlationId);
		request.responseData = GlobalExceptionFilter.toJsonValue(envelope);

		const httpAdapter = this.httpAdapterHost.httpAdapter;
		if (httpAdapter.isHeadersSent(reply)) {
			// A streaming response (SSE) already started — the status line is
			// gone, so the failure can only be logged, not reported.
			return;
		}

		const retryAfter = RetryAfterDetailSchema.safeParse(mapped.details);
		if (retryAfter.success) {
			httpAdapter.setHeader(reply, "Retry-After", String(retryAfter.data.retryAfterSeconds));
		}
		httpAdapter.reply(reply, envelope, mapped.httpStatus);
	}

	/** Build and validate the envelope; a malformed mapping degrades to a generic 500 body. */
	public static buildEnvelope(mapped: MappedError, correlationId: string): ApiErrorResponse {
		const candidate = ApiErrorResponseSchema.safeParse({
			success: false,
			error: {
				code: mapped.code,
				message: mapped.message,
				...(mapped.details !== undefined ? { details: mapped.details } : {}),
			},
			meta: { correlationId, timestamp: nowEpochMs() },
		});
		if (candidate.success) {
			return candidate.data;
		}
		return ApiErrorResponseSchema.parse({
			success: false,
			error: { code: ApiErrorCodes.INTERNAL_ERROR, message: STANDARD_ERROR_MESSAGES.INTERNAL_ERROR },
			meta: { correlationId, timestamp: nowEpochMs() },
		});
	}

	private static toJsonValue(envelope: ApiErrorResponse): JsonValue {
		const { details } = envelope.error;
		return {
			success: envelope.success,
			error: { code: envelope.error.code, message: envelope.error.message, ...(details !== undefined ? { details } : {}) },
			meta: { correlationId: envelope.meta.correlationId, timestamp: envelope.meta.timestamp },
		};
	}

	/**
	 * 5xx failures are logged server-side with the correlation id. An
	 * unexpected error (a bug, a provider failure) is logged at `error` with the
	 * full stack; a typed `AppError` 5xx (e.g. readiness 503 while draining) is
	 * an expected condition, logged at `warn` without a stack so probes do not
	 * flood the error stream.
	 */
	private logServerError(exception: CaughtValue, mapped: MappedError, request: FastifyRequest, correlationId: string): void {
		const error: Error | undefined = exception instanceof Error ? exception : undefined;
		const userId = request.user?.sub;
		const message = `HTTP ${request.method} ${redactUrl(request.url)} failed with ${String(mapped.httpStatus)} ${mapped.code}`;
		const options = {
			context: LOG_CONTEXT,
			...(userId !== undefined ? { userId } : {}),
			metadata: {
				correlationId,
				httpStatus: mapped.httpStatus,
				errorCode: mapped.code,
				errorName: error?.name ?? "NonErrorThrown",
				errorMessage: readCaughtErrorMessage(exception),
			},
		};
		if (exception instanceof AppError) {
			this.logService.warn(message, options);
			return;
		}
		this.logService.error(message, { ...options, ...(error?.stack !== undefined ? { trace: error.stack } : {}) });
	}
}
