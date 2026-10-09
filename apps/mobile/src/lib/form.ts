// Helpers shared by the TanStack Form screens (rules/06): one way to read a
// field's message and one way to submit from a button.

/** One validation message of a form field (TanStack Form's Standard Schema issues). */
export type FormFieldError = { readonly message?: string } | undefined;

/** A field's state as the screens read it. */
export interface FieldMetaView {
	readonly isTouched: boolean;
	readonly errors: readonly FormFieldError[];
}

/** The first message of a field the user has touched (or tried to submit), else nothing. */
export function visibleFieldError(meta: FieldMetaView): string | undefined {
	if (!meta.isTouched) {
		return undefined;
	}
	for (const error of meta.errors) {
		if (error?.message !== undefined && error.message.length > 0) {
			return error.message;
		}
	}
	return undefined;
}
