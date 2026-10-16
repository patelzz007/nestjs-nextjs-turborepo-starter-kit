import { MerchantErrorCodes } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ApiError } from "../../api/use-api";
import { FileProcessingError } from "../../storage/direct-upload";
import { classifyOnboardingFailure } from "./onboarding-outcome";

function apiError(code: string, statusCode: number): ApiError {
	return new ApiError({ message: "x", error: code, statusCode });
}

describe("classifyOnboardingFailure", () => {
	it("maps each onboarding code to its outcome", () => {
		expect(classifyOnboardingFailure(apiError(MerchantErrorCodes.MERCHANT_INVITE_EXPIRED, 410))).toEqual({ kind: "expired" });
		expect(classifyOnboardingFailure(apiError(MerchantErrorCodes.MERCHANT_INVITE_NOT_FOUND, 404))).toEqual({ kind: "invalid" });
		expect(classifyOnboardingFailure(apiError(MerchantErrorCodes.MERCHANT_INVITE_UNAVAILABLE, 409))).toEqual({ kind: "already-submitted" });
		expect(classifyOnboardingFailure(apiError(MerchantErrorCodes.MERCHANT_ONBOARDING_DOCUMENTS_CLOSED, 410))).toEqual({ kind: "documents-closed" });
	});

	it("shows a blocked or failed document as a clear error to retry", () => {
		expect(classifyOnboardingFailure(new FileProcessingError("rejected", "x", "QUARANTINED"))).toEqual({
			kind: "retry",
			message: "A document failed the security scan and was blocked. Upload a different file.",
		});
		expect(classifyOnboardingFailure(new FileProcessingError("rejected", "x", "FAILED"))).toEqual({
			kind: "retry",
			message: "A document could not be processed. Upload it again.",
		});
	});

	it("keeps any other failure on the step", () => {
		expect(classifyOnboardingFailure(apiError("VALIDATION_ERROR", 400)).kind).toBe("retry");
	});
});
