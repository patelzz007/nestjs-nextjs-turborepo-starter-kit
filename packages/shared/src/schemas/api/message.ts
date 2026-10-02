import { z } from "zod";

import { EpochMsSchema } from "./common";

/**
 * Standard message response schema.
 * Used by all endpoints that return a simple success/status message.
 * Deliberately NOT `.strict()`: it is a RESPONSE schema (ADR 022) — the API
 * strips unknown keys and clients must tolerate additive fields.
 */
export const MessageResponseSchema = z.object({
	message: z.string().meta({
		description: "Human-readable status message",
		example: "Operation completed successfully",
	}),
});

export type MessageResponse = z.output<typeof MessageResponseSchema>;

/**
 * Legacy FLAT error body (`{ message, error?, statusCode?, … }`).
 *
 * LEGACY: the API no longer returns this shape — every failure is the
 * `ApiErrorResponseSchema` envelope (`./api-error.ts`, docs/error-model.md).
 * Kept only so existing imports compile; do not use it for new code.
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
		/** Epoch ms when the account lockout expires (ACCOUNT_LOCKED only). */
		lockedUntil: EpochMsSchema.optional().meta({
			description: "Epoch ms when the account lockout expires",
			example: 1786300000000,
		}),
		/** Whole seconds until the lockout expires (ACCOUNT_LOCKED only). */
		remainingSeconds: z.number().int().min(0).optional().meta({
			description: "Whole seconds until the account lockout expires",
			example: 899,
		}),
	})
	.strict();

export type ErrorResponse = z.output<typeof ErrorResponseSchema>;

/** `{ ok: true }` — acknowledgement payload of fire-and-forget actions (send OTP, mark read, revoke key, …). */
export const OkResponseSchema = z.object({
	ok: z.literal(true).meta({ description: "The action was accepted", example: true }),
});

export type OkResponse = z.output<typeof OkResponseSchema>;

/** `{ success: true }` — acknowledgement payload of actions that return nothing else. */
export const SuccessAckResponseSchema = z.object({
	success: z.literal(true).meta({ description: "The action completed", example: true }),
});

export type SuccessAckResponse = z.output<typeof SuccessAckResponseSchema>;
