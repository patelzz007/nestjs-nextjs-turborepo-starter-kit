// ============================================
// lib/api/mutation-error.ts - user-facing messages for failed mutations
// ============================================
// Every admin mutation surfaces its failure: `useMutation({ onError })` calls
// `toastMutationError`, never a bare `void mutateAsync(...)` that drops the
// rejection. The message is chosen by the API's stable error `code`
// (docs/technical/api/errors.md) — first the caller's domain-specific overrides, then,
// for the transport-level codes whose server text says nothing actionable
// (session, rate limit, outage), a generic message, and otherwise the
// server's own message, which the API guarantees is client-safe and is the
// most specific reason for business failures ("A user can have at most 5
// roles", "Role … is not assigned to user …").

import { ApiError } from "@workspace/client/lib/api/api-request";
import { ApiErrorCodes, StandardApiErrorCodeSchema, type ApiErrorCode, type StandardApiErrorCode } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";

/** Messages for domain error codes a specific mutation can return (`{ ROLE_ALREADY_ASSIGNED: "…" }`). */
export type MutationErrorMessages = Readonly<Partial<Record<ApiErrorCode, string>>>;

/** Shown when the failure carries no usable code or message (network down, non-API error). */
export const UNKNOWN_MUTATION_ERROR_MESSAGE = "Something went wrong. Check your connection and try again.";

/** Generic message per transport-level code whose server text is not actionable for the admin. */
export const STANDARD_MUTATION_ERROR_MESSAGES: Readonly<Partial<Record<StandardApiErrorCode, string>>> = {
	[ApiErrorCodes.UNAUTHORIZED]: "Your session has expired. Sign in again.",
	[ApiErrorCodes.RATE_LIMITED]: "Too many requests. Wait a moment and try again.",
	[ApiErrorCodes.INTERNAL_ERROR]: "The server could not complete the request. Try again later.",
	[ApiErrorCodes.SERVICE_UNAVAILABLE]: "The service is temporarily unavailable. Try again later.",
	[ApiErrorCodes.GATEWAY_TIMEOUT]: "The request timed out. Try again.",
};

function messageForCode(code: string, overrides: MutationErrorMessages): string | undefined {
	const override = overrides[code];
	if (override !== undefined) {
		return override;
	}
	const standardCode = StandardApiErrorCodeSchema.safeParse(code);
	return standardCode.success ? STANDARD_MUTATION_ERROR_MESSAGES[standardCode.data] : undefined;
}

/** The message to show for a failed mutation: domain override → transport-level code message → server message → generic fallback. */
export function resolveMutationErrorMessage(error: Error, overrides: MutationErrorMessages = {}): string {
	if (!(error instanceof ApiError)) {
		return UNKNOWN_MUTATION_ERROR_MESSAGE;
	}
	const byCode = error.code === undefined ? undefined : messageForCode(error.code, overrides);
	if (byCode !== undefined) {
		return byCode;
	}
	return error.message.length > 0 ? error.message : UNKNOWN_MUTATION_ERROR_MESSAGE;
}

/** Shows an error toast titled `title` ("Could not assign role") with the resolved reason as its description. */
export function toastMutationError(title: string, error: Error, overrides: MutationErrorMessages = {}): void {
	toastMessage.error({ title, description: resolveMutationErrorMessage(error, overrides) });
}
