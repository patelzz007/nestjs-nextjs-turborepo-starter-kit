import { z } from "zod";

import { DateStringSchema } from "./common";

/**
 * Standard message response schema.
 * Used by all endpoints that return a simple success/status message.
 */
export const MessageResponseSchema = z
	.object({
		message: z.string().meta({
			description: "Human-readable status message",
			example: "Operation completed successfully",
		}),
	})
	.strict();

export type MessageResponse = z.output<typeof MessageResponseSchema>;

/**
 * Standard error response schema.
 * Returned by the HTTP exception filter for all error responses.
 *
 * `error` holds the canonical auth error code (see `AuthErrorCodeSchema`); the
 * lockout fields are present only on `ACCOUNT_LOCKED` responses so the client
 * can render a live countdown instead of a static message.
 */
export const ErrorResponseSchema = z
	.object({
		message: z.string().meta({
			description: "Human-readable error message",
			example: "Invalid email or password",
		}),
		error: z.string().optional().meta({
			description: "Error type / code (e.g. ACCESS_TOKEN_MISSING)",
			example: "Unauthorized",
		}),
		statusCode: z.number().int().optional().meta({
			description: "HTTP status code",
			example: 401,
		}),
		/** ISO-8601 instant when the account lockout expires (ACCOUNT_LOCKED only). */
		lockedUntil: DateStringSchema.optional().meta({
			description: "ISO-8601 instant when the account lockout expires",
			example: "2026-08-04T12:49:00.000Z",
		}),
		/** Whole seconds until the lockout expires (ACCOUNT_LOCKED only). */
		remainingSeconds: z.number().int().min(0).optional().meta({
			description: "Whole seconds until the account lockout expires",
			example: 899,
		}),
	})
	.strict();

export type ErrorResponse = z.output<typeof ErrorResponseSchema>;
