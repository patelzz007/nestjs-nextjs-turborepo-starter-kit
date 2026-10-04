import { ApiError } from "@workspace/client/lib/api/use-api";
import { MerchantErrorCodes } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { fieldErrorMessage, formErrorMessage, toFormSubmissionError, type FieldErrorMap } from "@/lib/forms/api-field-errors";

type Field = "store" | "name";

const FIELD_ERRORS: FieldErrorMap<Field> = {
	[MerchantErrorCodes.API_KEY_LOCATION_REQUIRED]: { field: "store", message: "Choose one of your stores." },
};

describe("toFormSubmissionError", () => {
	it("puts a mapped domain error on its field", () => {
		const error = toFormSubmissionError(new ApiError({ message: "x", error: MerchantErrorCodes.API_KEY_LOCATION_REQUIRED, statusCode: 403 }), FIELD_ERRORS, "fallback");

		expect(fieldErrorMessage(error, "store")).toBe("Choose one of your stores.");
		expect(fieldErrorMessage(error, "name")).toBeUndefined();
		expect(formErrorMessage(error)).toBeUndefined();
	});

	it("keeps any other failure a user-safe form-level error", () => {
		const unmapped = toFormSubmissionError(new ApiError({ message: "x", error: MerchantErrorCodes.TERMINAL_ID_TAKEN, statusCode: 409 }), FIELD_ERRORS, "fallback");
		expect(formErrorMessage(unmapped)).toBe("x");

		const outage = toFormSubmissionError(new TypeError("fetch failed: ECONNREFUSED 10.0.0.1"), FIELD_ERRORS, "fallback");
		expect(formErrorMessage(outage)).toBe("fallback");
	});
});
