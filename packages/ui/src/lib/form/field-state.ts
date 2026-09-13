/** Visual state for form controls — maps to CVA `state` variants. */
export type FieldState = "default" | "loading" | "disabled" | "error";

export interface FieldStateInput {
	readonly disabled?: boolean;
	readonly loading?: boolean;
	readonly ariaInvalid?: boolean | "true" | "false" | "grammar" | "spelling";
}

/** Derive CVA `state` from standard control props (no `typeof` checks). */
export function resolveFieldState(input: FieldStateInput): FieldState {
	if (input.disabled === true) {
		return "disabled";
	}
	if (input.loading === true) {
		return "loading";
	}
	if (input.ariaInvalid === true || input.ariaInvalid === "true") {
		return "error";
	}
	return "default";
}
