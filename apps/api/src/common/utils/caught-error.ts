import { JsonPrimitiveSchema, JsonRecordSchema, ResendLikeErrorSchema, type CaughtValue } from "@workspace/shared";

function formatCaughtValue(value: CaughtValue): string {
	if (value === undefined) {
		return "undefined";
	}
	if (value instanceof Error) {
		return value.message;
	}
	const primitive = JsonPrimitiveSchema.safeParse(value);
	if (primitive.success) {
		return primitive.data === null ? "null" : String(primitive.data);
	}
	return JSON.stringify(value);
}

/** Normalizes a caught value into an `Error` for logging and rethrow. */
export function normalizeCaughtError(value: CaughtValue): Error {
	if (value instanceof Error) {
		return value;
	}
	const objectValue = JsonRecordSchema.safeParse(value);
	if (objectValue.success) {
		const detail = ResendLikeErrorSchema.safeParse(objectValue.data);
		if (detail.success) {
			return new Error(detail.data.message ?? "Operation failed");
		}
	}
	return new Error(formatCaughtValue(value));
}

/** Reads an optional string `code` from a caught Resend-like rejection object. */
export function readCaughtErrorCode(value: CaughtValue): string | undefined {
	const objectValue = JsonRecordSchema.safeParse(value);
	if (!objectValue.success) {
		return undefined;
	}
	const detail = ResendLikeErrorSchema.safeParse(objectValue.data);
	return detail.success ? detail.data.code : undefined;
}

/** Reads a message from a caught value without using `unknown`. */
export function readCaughtErrorMessage(value: CaughtValue): string {
	if (value instanceof Error) {
		return value.message;
	}
	const objectValue = JsonRecordSchema.safeParse(value);
	if (objectValue.success) {
		const detail = ResendLikeErrorSchema.safeParse(objectValue.data);
		if (detail.success && detail.data.message !== undefined) {
			return detail.data.message;
		}
	}
	return formatCaughtValue(value);
}

export type { CaughtValue };
