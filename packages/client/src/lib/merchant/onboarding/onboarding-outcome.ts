import { MerchantErrorCodeSchema, MerchantErrorCodes, type CaughtValue, type MerchantErrorCode } from "@workspace/shared";

import { ApiError } from "../../api/use-api";
import { resolveAuthErrorMessage } from "../../auth/errors";
import { FileProcessingError } from "../../storage/direct-upload";

/**
 * What the onboarding wizard does with a failed request — decided from the
 * API's shared domain error codes, never from message text:
 *
 * - `expired` / `invalid` — the invite cannot be used: a terminal state with a way back to sign in;
 * - `already-submitted` — `complete` already succeeded (a retry after the
 *   documents failed): skip straight to the document upload, never complete twice;
 * - `documents-closed` — the link no longer takes documents: sign in and use
 *   the verification page;
 * - `retry` — anything else: stay on the step, show a user-safe message.
 */
export type OnboardingFailure =
	| { readonly kind: "expired" }
	| { readonly kind: "invalid" }
	| { readonly kind: "already-submitted" }
	| { readonly kind: "documents-closed" }
	| { readonly kind: "retry"; readonly message: string };

/** The terminal / redirecting outcome of each domain code (open for extension: one entry per code). */
const OUTCOME_BY_CODE: Readonly<Partial<Record<MerchantErrorCode, OnboardingFailure>>> = {
	[MerchantErrorCodes.MERCHANT_INVITE_EXPIRED]: { kind: "expired" },
	[MerchantErrorCodes.MERCHANT_INVITE_NOT_FOUND]: { kind: "invalid" },
	[MerchantErrorCodes.MERCHANT_INVITE_UNAVAILABLE]: { kind: "already-submitted" },
	[MerchantErrorCodes.MERCHANT_ONBOARDING_DOCUMENTS_CLOSED]: { kind: "documents-closed" },
};

/** A user-safe message for a document that failed processing after upload. */
export function describeDocumentProcessingFailure(error: FileProcessingError): string {
	if (error.kind === "timeout") {
		return "A document is still being checked. Try again in a moment.";
	}
	return error.status === "QUARANTINED"
		? "A document failed the security scan and was blocked. Upload a different file."
		: "A document could not be processed. Upload it again.";
}

export function classifyOnboardingFailure(error: CaughtValue): OnboardingFailure {
	if (error instanceof ApiError) {
		const code = MerchantErrorCodeSchema.safeParse(error.code);
		const outcome = code.success ? OUTCOME_BY_CODE[code.data] : undefined;
		if (outcome !== undefined) {
			return outcome;
		}
	}
	if (error instanceof FileProcessingError) {
		return { kind: "retry", message: describeDocumentProcessingFailure(error) };
	}
	return { kind: "retry", message: resolveAuthErrorMessage(error) };
}
