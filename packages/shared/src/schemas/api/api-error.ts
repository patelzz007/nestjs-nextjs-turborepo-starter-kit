import { z } from "zod";

import { JsonValueSchema } from "../runtime/json";
import { ApiResponseMetaSchema } from "./api-response";

// ── Error envelope (docs/technical/api/errors.md, ADR 015) ─────────────────────────
//
// Every non-2xx JSON response from the API has exactly this shape:
//
//   { success: false, error: { code, message, details? }, meta: { correlationId, timestamp } }
//
// It mirrors the success envelope (`{ success: true, data, meta }`) so a
// client branches on `success` once and always finds `meta.correlationId`
// in the same place for support tickets and log lookups.

/** Upper bound on an error code's length — codes are identifiers, not prose. */
const API_ERROR_CODE_MAX_LENGTH = 64;

/**
 * A stable, machine-matchable error code (`SCREAMING_SNAKE_CASE`).
 *
 * Deliberately an open string rather than an enum: feature modules own their
 * own domain codes (`ACCESS_TOKEN_EXPIRED`, `REWARD_OUT_OF_STOCK`, …). The
 * generic, status-level codes every endpoint can emit are enumerated in
 * {@link StandardApiErrorCodeSchema}.
 */
export const ApiErrorCodeSchema = z
	.string()
	.max(API_ERROR_CODE_MAX_LENGTH)
	.regex(/^[A-Z][A-Z0-9_]*$/)
	.meta({ description: "Stable machine-readable error code (SCREAMING_SNAKE_CASE)", example: "VALIDATION_ERROR" });

export type ApiErrorCode = z.output<typeof ApiErrorCodeSchema>;

/** Generic error codes the API's global exception filter can emit for any endpoint. */
export const StandardApiErrorCodeSchema = z.enum([
	"BAD_REQUEST",
	"VALIDATION_ERROR",
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"CONFLICT",
	"PAYLOAD_TOO_LARGE",
	"UNSUPPORTED_MEDIA_TYPE",
	"UNPROCESSABLE_ENTITY",
	"RATE_LIMITED",
	"IDEMPOTENCY_KEY_REQUIRED",
	"IDEMPOTENCY_KEY_REUSED",
	"IDEMPOTENCY_REQUEST_IN_PROGRESS",
	"INTERNAL_ERROR",
	"EXTERNAL_SERVICE_ERROR",
	"SERVICE_UNAVAILABLE",
	"GATEWAY_TIMEOUT",
]);

export type StandardApiErrorCode = z.output<typeof StandardApiErrorCodeSchema>;

/** Enum-style accessor (`ApiErrorCodes.NOT_FOUND`) so call sites never repeat a bare string. */
export const ApiErrorCodes = StandardApiErrorCodeSchema.enum;

/** One field-level validation failure, carried in `error.details.issues`. */
export const ApiValidationIssueSchema = z
	.object({
		path: z.string().meta({ description: "Dot-separated path of the invalid field (`root` for the whole payload)", example: "email" }),
		message: z.string().meta({ description: "Human-readable reason", example: "Field 'email' must be a valid email" }),
		code: z.string().meta({ description: "Validator keyword that failed", example: "format" }),
	})
	.strict();

export type ApiValidationIssue = z.output<typeof ApiValidationIssueSchema>;

/**
 * Structured, client-safe metadata about an error. Never contains stack
 * traces, SQL, file paths, or provider messages — the API filter builds it
 * from an allowlist (validation issues, lockout timing, retry hints, …).
 */
export const ApiErrorDetailsSchema = z.record(z.string(), JsonValueSchema).meta({
	description: "Structured, client-safe error metadata (e.g. `issues` for validation errors)",
});

export type ApiErrorDetails = z.output<typeof ApiErrorDetailsSchema>;

/** The `error` object of the error envelope. */
export const ApiErrorObjectSchema = z
	.object({
		code: ApiErrorCodeSchema,
		message: z.string().min(1).meta({ description: "Human-readable, client-safe message", example: "Validation failed" }),
		details: ApiErrorDetailsSchema.optional(),
	})
	.strict();

export type ApiErrorObject = z.output<typeof ApiErrorObjectSchema>;

/**
 * Standard error response envelope — returned by the API's global exception
 * filter for every failed request (HTTP 4xx/5xx).
 */
export const ApiErrorResponseSchema = z
	.object({
		success: z.literal(false).meta({
			description: "Indicates the request failed",
			example: false,
		}),
		error: ApiErrorObjectSchema,
		meta: ApiResponseMetaSchema,
	})
	.strict();

export type ApiErrorResponse = z.output<typeof ApiErrorResponseSchema>;

/**
 * The flattened error body exposed by the client's `ApiError` class.
 *
 * `error` holds the machine code (the envelope's `error.code`) and
 * `statusCode` the HTTP status, so existing UI code (`error.error ===
 * "INVALID_CREDENTIALS"`, `statusCode === 401`) keeps working unchanged. The
 * client also still accepts this flat shape on the wire for responses that
 * do not come through the API's exception filter (older API builds, proxies).
 */
export const ApiErrorBodySchema = z
	.object({
		message: z.string().meta({
			description: "Human-readable error message",
			example: "Invalid email or password",
		}),
		statusCode: z.number().int().optional().meta({
			description: "HTTP status code",
			example: 401,
		}),
		error: z.string().optional().meta({
			description: "Error type / code (e.g. ACCESS_TOKEN_MISSING)",
			example: "INVALID_CREDENTIALS",
		}),
	})
	.strict();

export type ApiErrorBody = z.output<typeof ApiErrorBodySchema>;
