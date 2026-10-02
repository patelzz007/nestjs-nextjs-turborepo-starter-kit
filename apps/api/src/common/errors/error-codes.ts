import { HttpStatus } from "@nestjs/common";
import { ApiErrorCodes, type StandardApiErrorCode } from "@workspace/shared";

/**
 * Client-safe default message for every standard error code. Used whenever a
 * more specific message is unavailable or unsafe to expose (e.g. a 5xx in
 * production, where the original message may carry provider/SQL detail).
 */
export const STANDARD_ERROR_MESSAGES: Readonly<Record<StandardApiErrorCode, string>> = {
	BAD_REQUEST: "The request is invalid.",
	VALIDATION_ERROR: "Validation failed.",
	UNAUTHORIZED: "Authentication is required.",
	FORBIDDEN: "You do not have permission to perform this action.",
	NOT_FOUND: "The requested resource was not found.",
	CONFLICT: "The request conflicts with the current state of the resource.",
	PAYLOAD_TOO_LARGE: "The request body is too large.",
	UNSUPPORTED_MEDIA_TYPE: "The request content type is not supported.",
	UNPROCESSABLE_ENTITY: "The request could not be processed.",
	RATE_LIMITED: "Too many requests. Please retry later.",
	IDEMPOTENCY_KEY_REQUIRED: "An Idempotency-Key header is required for this request.",
	IDEMPOTENCY_KEY_REUSED: "This Idempotency-Key was already used with a different request.",
	IDEMPOTENCY_REQUEST_IN_PROGRESS: "A request with this Idempotency-Key is still being processed. Retry shortly.",
	INTERNAL_ERROR: "An unexpected error occurred.",
	EXTERNAL_SERVICE_ERROR: "An upstream service failed to respond correctly.",
	SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
	GATEWAY_TIMEOUT: "An upstream service timed out.",
};

/** HTTP status → generic code, for exceptions that carry a status but no domain code. */
const STATUS_TO_CODE: ReadonlyMap<number, StandardApiErrorCode> = new Map<number, StandardApiErrorCode>([
	[HttpStatus.BAD_REQUEST, ApiErrorCodes.BAD_REQUEST],
	[HttpStatus.UNAUTHORIZED, ApiErrorCodes.UNAUTHORIZED],
	[HttpStatus.FORBIDDEN, ApiErrorCodes.FORBIDDEN],
	[HttpStatus.NOT_FOUND, ApiErrorCodes.NOT_FOUND],
	[HttpStatus.CONFLICT, ApiErrorCodes.CONFLICT],
	[HttpStatus.PAYLOAD_TOO_LARGE, ApiErrorCodes.PAYLOAD_TOO_LARGE],
	[HttpStatus.UNSUPPORTED_MEDIA_TYPE, ApiErrorCodes.UNSUPPORTED_MEDIA_TYPE],
	[HttpStatus.UNPROCESSABLE_ENTITY, ApiErrorCodes.UNPROCESSABLE_ENTITY],
	[HttpStatus.TOO_MANY_REQUESTS, ApiErrorCodes.RATE_LIMITED],
	[HttpStatus.INTERNAL_SERVER_ERROR, ApiErrorCodes.INTERNAL_ERROR],
	[HttpStatus.BAD_GATEWAY, ApiErrorCodes.EXTERNAL_SERVICE_ERROR],
	[HttpStatus.SERVICE_UNAVAILABLE, ApiErrorCodes.SERVICE_UNAVAILABLE],
	[HttpStatus.GATEWAY_TIMEOUT, ApiErrorCodes.GATEWAY_TIMEOUT],
]);

/** Lowest HTTP status that counts as a server-side failure. */
export const HTTP_SERVER_ERROR_MIN_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

/** Lowest HTTP status that counts as an error at all. */
export const HTTP_CLIENT_ERROR_MIN_STATUS: number = HttpStatus.BAD_REQUEST;

/** Map any error status to its generic code (unknown 4xx → BAD_REQUEST, unknown 5xx → INTERNAL_ERROR). */
export function standardCodeForStatus(httpStatus: number): StandardApiErrorCode {
	const known: StandardApiErrorCode | undefined = STATUS_TO_CODE.get(httpStatus);
	if (known !== undefined) {
		return known;
	}
	return httpStatus >= HTTP_SERVER_ERROR_MIN_STATUS ? ApiErrorCodes.INTERNAL_ERROR : ApiErrorCodes.BAD_REQUEST;
}

/** True for 5xx statuses. */
export function isServerErrorStatus(httpStatus: number): boolean {
	return httpStatus >= HTTP_SERVER_ERROR_MIN_STATUS;
}
