import { HttpStatus } from "@nestjs/common";
import { ApiErrorCodes, type StandardApiErrorCode } from "@workspace/shared";

/**
 * 426 Upgrade Required (RFC 9110 §15.5.22) — not in Nest's `HttpStatus` enum.
 * The API answers it only to a mobile app older than `MOBILE_MIN_SUPPORTED_VERSION` (ADR 033).
 */
export const HTTP_STATUS_UPGRADE_REQUIRED = 426;

/** Every HTTP status an `AppError` can carry: Nest's statuses plus 426, which Nest's enum omits. */
export type AppErrorHttpStatus = HttpStatus | typeof HTTP_STATUS_UPGRADE_REQUIRED;

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
	[HTTP_STATUS_UPGRADE_REQUIRED, ApiErrorCodes.APP_VERSION_UNSUPPORTED],
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
