import { HttpStatus } from "@nestjs/common";

/**
 * Standardized error response format for all API modules.
 *
 * This ensures consistent error responses across the entire API,
 * making it easier for clients to handle errors uniformly.
 */
export interface StandardErrorResponse {
	readonly success: false;
	readonly error: {
		readonly message: string;
		readonly code: string;
		readonly statusCode: number;
		readonly details?: readonly {
			readonly field: string;
			readonly message: string;
		}[];
	};
	readonly meta: {
		readonly correlationId: string;
		readonly timestamp: number;
	};
}

/**
 * Create a standardized error response.
 *
 * @param message - Human-readable error message
 * @param code - Machine-readable error code (e.g., "VALIDATION_ERROR")
 * @param statusCode - HTTP status code
 * @param correlationId - Request correlation ID
 * @param details - Optional field-level validation errors
 * @returns Standardized error response object
 */
export function createStandardErrorResponse(
	message: string,
	code: string,
	statusCode: number,
	correlationId: string,
	details?: readonly { readonly field: string; readonly message: string }[],
): StandardErrorResponse {
	return {
		success: false,
		error: {
			message,
			code,
			statusCode,
			...(details !== undefined && { details }),
		},
		meta: {
			correlationId,
			timestamp: Date.now(),
		},
	};
}

/**
 * Common error codes used across the API.
 */
export const ErrorCodes = {
	VALIDATION_ERROR: "VALIDATION_ERROR",
	NOT_FOUND: "NOT_FOUND",
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	CONFLICT: "CONFLICT",
	RATE_LIMITED: "RATE_LIMITED",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	BAD_REQUEST: "BAD_REQUEST",
} as const;

/**
 * HTTP status code mapping for error codes.
 */
export const ErrorStatusCodes: Record<string, number> = {
	[ErrorCodes.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
	[ErrorCodes.NOT_FOUND]: HttpStatus.NOT_FOUND,
	[ErrorCodes.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
	[ErrorCodes.FORBIDDEN]: HttpStatus.FORBIDDEN,
	[ErrorCodes.CONFLICT]: HttpStatus.CONFLICT,
	[ErrorCodes.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
	[ErrorCodes.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
	[ErrorCodes.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
};
