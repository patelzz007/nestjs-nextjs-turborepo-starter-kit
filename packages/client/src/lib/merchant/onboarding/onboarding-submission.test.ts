import { MerchantErrorCodes } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/use-api";
import { runOnboardingSubmission } from "./onboarding-submission";

function apiError(code: string, statusCode: number): ApiError {
	return new ApiError({ message: "x", error: code, statusCode });
}

describe("runOnboardingSubmission", () => {
	it("completes the application, then submits the documents", async () => {
		const submitDocuments = vi.fn((): Promise<void> => Promise.resolve());
		const result = await runOnboardingSubmission({ completeApplication: (): Promise<string> => Promise.resolve("Brew & Bean"), submitDocuments }, false);

		expect(result).toEqual({ kind: "submitted", businessName: "Brew & Bean" });
		expect(submitDocuments).toHaveBeenCalledTimes(1);
	});

	it("never calls complete again once it succeeded — a retry only submits the documents", async () => {
		const completeApplication = vi.fn((): Promise<string> => Promise.resolve("Brew & Bean"));
		const result = await runOnboardingSubmission({ completeApplication, submitDocuments: (): Promise<void> => Promise.resolve() }, true);

		expect(completeApplication).not.toHaveBeenCalled();
		expect(result.kind).toBe("submitted");
	});

	it("goes straight to the documents when complete answers MERCHANT_INVITE_UNAVAILABLE (already submitted)", async () => {
		const submitDocuments = vi.fn((): Promise<void> => Promise.resolve());
		const result = await runOnboardingSubmission(
			{ completeApplication: (): Promise<string> => Promise.reject(apiError(MerchantErrorCodes.MERCHANT_INVITE_UNAVAILABLE, 409)), submitDocuments },
			false,
		);

		expect(submitDocuments).toHaveBeenCalledTimes(1);
		expect(result.kind).toBe("submitted");
	});

	it("reports a closed documents window, remembering the application was submitted", async () => {
		const result = await runOnboardingSubmission(
			{
				completeApplication: (): Promise<string> => Promise.resolve("Brew & Bean"),
				submitDocuments: (): Promise<void> => Promise.reject(apiError(MerchantErrorCodes.MERCHANT_ONBOARDING_DOCUMENTS_CLOSED, 410)),
			},
			false,
		);

		expect(result).toEqual({ kind: "failed", failure: { kind: "documents-closed" }, isApplicationSubmitted: true });
	});

	it("reports an expired invite without submitting documents", async () => {
		const submitDocuments = vi.fn((): Promise<void> => Promise.resolve());
		const result = await runOnboardingSubmission(
			{ completeApplication: (): Promise<string> => Promise.reject(apiError(MerchantErrorCodes.MERCHANT_INVITE_EXPIRED, 410)), submitDocuments },
			false,
		);

		expect(result).toEqual({ kind: "failed", failure: { kind: "expired" }, isApplicationSubmitted: false });
		expect(submitDocuments).not.toHaveBeenCalled();
	});
});
