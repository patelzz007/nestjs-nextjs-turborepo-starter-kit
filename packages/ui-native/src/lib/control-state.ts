/**
 * The visual state of a control — the CVA `state` axis every component in this
 * kit exposes. The same vocabulary and precedence as the web kit's
 * `resolveFieldState` (packages/ui/src/lib/form/field-state.ts), so a state
 * means the same thing on both platforms.
 */
export type ControlState = "default" | "loading" | "disabled" | "error";

export interface ControlStateInput {
	readonly disabled?: boolean | undefined;
	readonly loading?: boolean | undefined;
	/** The caller's validation outcome (a zod / form-library error). The control never validates by itself. */
	readonly invalid?: boolean | undefined;
}

/** `disabled` wins over `loading`, which wins over `error`: an inactive control shows no error styling. */
export function resolveControlState(input: ControlStateInput): ControlState {
	if (input.disabled === true) {
		return "disabled";
	}
	if (input.loading === true) {
		return "loading";
	}
	return input.invalid === true ? "error" : "default";
}

/** Whether a control in `state` takes no input (disabled or busy). */
export function isInactiveState(state: ControlState): boolean {
	return state === "disabled" || state === "loading";
}
