// ============================================
// caught-error-log.ts - what a log line says about a caught value
// ============================================
// Every `catch` that logs a failure and moves on (a scheduler tick, an
// after-commit handler, a background job) logs it through this, so the line
// carries the error's stack, not only its message: the message alone says what
// went wrong, the stack says where. A thrown non-Error (a string, a plain
// object) has no stack; it is logged as its text.

import { JsonPrimitiveSchema, type CaughtValue } from "@workspace/shared";

/** The fields a log line carries for a caught value: its message, and its stack when it has one. */
export interface CaughtErrorLogFields {
	readonly error: string;
	readonly stack?: string;
}

/** The log fields for a caught value: `{ error, stack }` for an Error, `{ error }` for anything else thrown. */
export function caughtErrorLogFields(value: CaughtValue): CaughtErrorLogFields {
	if (value instanceof Error) {
		return value.stack === undefined ? { error: value.message } : { error: value.message, stack: value.stack };
	}
	if (value === undefined) {
		return { error: "undefined" };
	}
	const primitive = JsonPrimitiveSchema.safeParse(value);
	return { error: primitive.success ? String(primitive.data) : JSON.stringify(value) };
}
