import { ApiError } from "@workspace/client/lib/api/use-api";
import { MerchantErrorCodeSchema, type MerchantErrorCode } from "@workspace/shared";

import { userSafeErrorMessage } from "@/lib/query/query-policy";

/**
 * Maps the API's domain error codes onto the form field they are about, so a
 * refused submit renders next to the input the merchant must change — never
 * as a generic banner. Each form declares its own map (open for extension:
 * a new code is one more entry), and every other failure stays a form-level,
 * user-safe message.
 */

/** Where one domain error code is shown in a form, and what it says. */
export interface FieldErrorTarget<TField extends string> {
	readonly field: TField;
	readonly message: string;
}

export type FieldErrorMap<TField extends string> = Readonly<Partial<Record<MerchantErrorCode, FieldErrorTarget<TField>>>>;

/** A failed submit, as a form renders it: on one field, or for the whole form. */
export type FormSubmissionError<TField extends string> =
	{ readonly kind: "field"; readonly field: TField; readonly message: string } | { readonly kind: "form"; readonly message: string };

/** The error a form shows for `error`, using its field map; anything unmapped becomes a user-safe form error. */
export function toFormSubmissionError<TField extends string>(error: Error, fieldErrors: FieldErrorMap<TField>, fallbackMessage: string): FormSubmissionError<TField> {
	if (error instanceof ApiError) {
		const code = MerchantErrorCodeSchema.safeParse(error.code);
		const target = code.success ? fieldErrors[code.data] : undefined;
		if (target !== undefined) {
			return { kind: "field", field: target.field, message: target.message };
		}
	}
	return { kind: "form", message: userSafeErrorMessage(error, fallbackMessage) };
}

/** The message for `field` (`undefined` when the error is elsewhere or there is none). */
export function fieldErrorMessage<TField extends string>(error: FormSubmissionError<TField> | null, field: TField): string | undefined {
	return error?.kind === "field" && error.field === field ? error.message : undefined;
}

/** The form-level message (`undefined` when the error is on a field or there is none). */
export function formErrorMessage<TField extends string>(error: FormSubmissionError<TField> | null): string | undefined {
	return error?.kind === "form" ? error.message : undefined;
}
