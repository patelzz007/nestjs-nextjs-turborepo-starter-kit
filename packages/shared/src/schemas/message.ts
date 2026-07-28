import { z } from "zod";

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
 */
export const ErrorResponseSchema = z
	.object({
		message: z.string().meta({
			description: "Human-readable error message",
			example: "Invalid email or password",
		}),
		error: z.string().optional().meta({
			description: "Error type / code",
			example: "Unauthorized",
		}),
		statusCode: z.number().int().optional().meta({
			description: "HTTP status code",
			example: 401,
		}),
	})
	.strict();

export type ErrorResponse = z.output<typeof ErrorResponseSchema>;
