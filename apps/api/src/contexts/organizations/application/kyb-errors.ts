import { NotFoundError } from "../../../platform/application/errors/app-error";

/** A KYB route for an organization that has no merchant profile. */
export function merchantNotFound(): NotFoundError {
	return new NotFoundError({ code: "MERCHANT_NOT_FOUND", message: "Merchant not found" });
}

/** An onboarding token that names no pending invite (or one whose organization has no merchant profile). */
export function merchantInviteNotFound(): NotFoundError {
	return new NotFoundError({ code: "MERCHANT_INVITE_NOT_FOUND", message: "Invalid merchant invite" });
}

/** An onboarding upload id that is not this onboarding's own KYB upload. */
export function onboardingFileNotFound(): NotFoundError {
	return new NotFoundError({ code: "FILE_NOT_FOUND", message: "File not found" });
}
