import { ApiError } from "@workspace/client/lib/api/api-request";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveMutationErrorMessage, STANDARD_MUTATION_ERROR_MESSAGES, toastMutationError, UNKNOWN_MUTATION_ERROR_MESSAGE } from "@/lib/api/mutation-error";

function apiError(code: string, message: string, statusCode: number): ApiError {
	return new ApiError({ error: code, message, statusCode });
}

describe("resolveMutationErrorMessage", () => {
	it("prefers the caller's message for a domain code", () => {
		expect(resolveMutationErrorMessage(apiError("ROLE_ALREADY_ASSIGNED", "Conflict", 409), { ROLE_ALREADY_ASSIGNED: "The user already has this role." })).toBe(
			"The user already has this role.",
		);
	});

	it("maps a transport-level code to its generic message", () => {
		expect(resolveMutationErrorMessage(apiError("RATE_LIMITED", "ThrottlerException: Too Many Requests", 429))).toBe(STANDARD_MUTATION_ERROR_MESSAGES.RATE_LIMITED);
	});

	it("keeps the server's specific, client-safe reason for a business failure", () => {
		expect(resolveMutationErrorMessage(apiError("CONFLICT", "A user can have at most 5 roles.", 409))).toBe("A user can have at most 5 roles.");
	});

	it("falls back to the server's client-safe message for an unmapped code", () => {
		expect(resolveMutationErrorMessage(apiError("REWARD_OUT_OF_STOCK", "This reward is out of stock", 409))).toBe("This reward is out of stock");
	});

	it("uses the generic fallback for a non-API failure", () => {
		expect(resolveMutationErrorMessage(new TypeError("Failed to fetch"))).toBe(UNKNOWN_MUTATION_ERROR_MESSAGE);
	});
});

describe("toastMutationError", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("shows an error toast with the action as the title and the reason as the description", () => {
		const errorToast = vi.spyOn(toastMessage, "error").mockImplementation(() => "toast-id");
		toastMutationError("Could not assign role", apiError("UNAUTHORIZED", "Unauthorized", 401));
		expect(errorToast).toHaveBeenCalledWith({ title: "Could not assign role", description: STANDARD_MUTATION_ERROR_MESSAGES.UNAUTHORIZED });
	});
});
