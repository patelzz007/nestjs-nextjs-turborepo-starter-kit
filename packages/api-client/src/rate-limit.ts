// What a client does with a 429 (ADR 071): the API says how long to wait (`details.retryAfterSeconds`,
// mirrored in `Retry-After`); the person is told in words, and nothing retries before then.

import { ApiErrorCodes } from "@workspace/shared";
import { z } from "zod";

import { ApiError } from "./errors";

const HTTP_TOO_MANY_REQUESTS = 429;
const SECONDS_PER_MINUTE = 60;

const RetryAfterDetailsSchema = z.object({ retryAfterSeconds: z.number().int().positive() });

/** Whether the API refused this call for going too fast. */
export function isRateLimitError(error: Error): boolean {
	return error instanceof ApiError && (error.statusCode === HTTP_TOO_MANY_REQUESTS || error.code === ApiErrorCodes.RATE_LIMITED);
}

/** How long the API asked the caller to wait, or null when it is not a 429 or named no time. */
export function rateLimitRetryAfterSeconds(error: Error): number | null {
	if (!(error instanceof ApiError) || !isRateLimitError(error)) {
		return null;
	}
	const details = RetryAfterDetailsSchema.safeParse(error.details);
	return details.success ? details.data.retryAfterSeconds : null;
}

/** The wait in words: "a few seconds", "30 seconds", "2 minutes". */
export function describeWait(seconds: number | null): string {
	if (seconds === null) {
		return "a moment";
	}
	if (seconds < SECONDS_PER_MINUTE) {
		return seconds === 1 ? "1 second" : `${String(seconds)} seconds`;
	}
	const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
	return minutes === 1 ? "1 minute" : `${String(minutes)} minutes`;
}

/**
 * The message for a 429, or null for any other failure: the wait in words when the API named it,
 * otherwise the API's own (client-safe) message, otherwise "a moment".
 */
export function rateLimitMessage(error: Error): string | null {
	if (!isRateLimitError(error)) {
		return null;
	}
	const seconds = rateLimitRetryAfterSeconds(error);
	if (seconds === null && error.message.length > 0) {
		return error.message;
	}
	return `Too many requests. Try again in ${describeWait(seconds)}.`;
}
