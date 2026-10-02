import { HttpStatus } from "@nestjs/common";
import { ApiErrorCodeSchema, ApiErrorCodes, type ApiErrorCode, type ApiErrorDetails, type StandardApiErrorCode } from "@workspace/shared";

import { STANDARD_ERROR_MESSAGES } from "./error-codes";

/** Everything needed to construct an {@link AppError} directly. */
export interface AppErrorOptions {
	/** Stable, machine-matchable code (`SCREAMING_SNAKE_CASE`). */
	readonly code: ApiErrorCode;
	/** HTTP status the global exception filter responds with. */
	readonly httpStatus: HttpStatus;
	/** Client-safe, human-readable message. Never include secrets, SQL, or internal paths. */
	readonly message: string;
	/** Client-safe structured metadata (validation issues, retry hints, …). */
	readonly details?: ApiErrorDetails | undefined;
	/** Underlying error — logged server-side, never sent to the client. */
	readonly cause?: Error | undefined;
}

/** Optional overrides accepted by the concrete subclasses (each has sensible defaults). */
export interface AppErrorOverrides {
	readonly code?: ApiErrorCode;
	readonly message?: string;
	readonly details?: ApiErrorDetails;
	readonly cause?: Error;
}

/**
 * Base class for every expected, typed application failure.
 *
 * The global exception filter (`GlobalExceptionFilter`) turns an `AppError`
 * into the standard error envelope using exactly these fields, so the
 * `message` and `details` MUST be safe to show a client. Anything sensitive
 * belongs in `cause`, which is only ever logged server-side.
 *
 * Prefer a subclass (`NotFoundError`, `ConflictError`, …) — construct the
 * base directly only for a status that has no subclass yet.
 */
export class AppError extends Error {
	public readonly code: ApiErrorCode;
	public readonly httpStatus: HttpStatus;
	public readonly details: ApiErrorDetails | undefined;

	public constructor(options: AppErrorOptions) {
		super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
		this.name = new.target.name;
		// Fail at the throw site (a developer bug) rather than emitting an
		// envelope clients cannot match on.
		this.code = ApiErrorCodeSchema.parse(options.code);
		this.httpStatus = options.httpStatus;
		this.details = options.details;
	}
}

/** Builds the constructor options for a subclass from its defaults plus caller overrides. */
function withDefaults(defaultCode: StandardApiErrorCode, httpStatus: HttpStatus, overrides: AppErrorOverrides): AppErrorOptions {
	const code: ApiErrorCode = overrides.code ?? defaultCode;
	return {
		code,
		httpStatus,
		message: overrides.message ?? STANDARD_ERROR_MESSAGES[defaultCode],
		details: overrides.details,
		cause: overrides.cause,
	};
}

/** 400 — the request payload failed validation. */
export class ValidationError extends AppError {
	public constructor(overrides: AppErrorOverrides = {}) {
		super(withDefaults(ApiErrorCodes.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, overrides));
	}
}

/** 401 — the caller is not authenticated (missing/invalid/expired credentials). */
export class AuthenticationError extends AppError {
	public constructor(overrides: AppErrorOverrides = {}) {
		super(withDefaults(ApiErrorCodes.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, overrides));
	}
}

/** 403 — the caller is authenticated but not allowed to do this. */
export class AuthorizationError extends AppError {
	public constructor(overrides: AppErrorOverrides = {}) {
		super(withDefaults(ApiErrorCodes.FORBIDDEN, HttpStatus.FORBIDDEN, overrides));
	}
}

/** 404 — the resource does not exist (or is not visible to the caller). */
export class NotFoundError extends AppError {
	public constructor(overrides: AppErrorOverrides = {}) {
		super(withDefaults(ApiErrorCodes.NOT_FOUND, HttpStatus.NOT_FOUND, overrides));
	}
}

/** 409 — the request conflicts with current state (duplicate, stale version, reused idempotency key). */
export class ConflictError extends AppError {
	public constructor(overrides: AppErrorOverrides = {}) {
		super(withDefaults(ApiErrorCodes.CONFLICT, HttpStatus.CONFLICT, overrides));
	}
}

/** 429 — the caller exceeded a rate limit. Put `retryAfterSeconds` in `details` to emit `Retry-After`. */
export class RateLimitError extends AppError {
	public constructor(overrides: AppErrorOverrides = {}) {
		super(withDefaults(ApiErrorCodes.RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS, overrides));
	}
}

/** 502 — a third-party provider (email, payment, storage) failed or answered garbage. */
export class ExternalServiceError extends AppError {
	public constructor(overrides: AppErrorOverrides = {}) {
		super(withDefaults(ApiErrorCodes.EXTERNAL_SERVICE_ERROR, HttpStatus.BAD_GATEWAY, overrides));
	}
}

/** 503 — a required dependency (database, queue) is unavailable; the request may succeed on retry. */
export class DependencyUnavailableError extends AppError {
	public constructor(overrides: AppErrorOverrides = {}) {
		super(withDefaults(ApiErrorCodes.SERVICE_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE, overrides));
	}
}
