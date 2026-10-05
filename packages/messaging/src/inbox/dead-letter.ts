import { createHash } from "node:crypto";

import type { DeadLetterPayload } from "./inbox";

/** Hash algorithm recorded for every parked value (hex digest, 64 chars). */
const PAYLOAD_HASH_ALGORITHM = "sha256";

/**
 * Bound on the stored error text. Error messages are ours (decode/zod/pg
 * messages), so a cap is fine — but a cut is always marked, with the original
 * length, never silent.
 */
export const DEAD_LETTER_ERROR_MAX_CHARS = 4_000;

/**
 * The value to store for a parked record: the raw bytes up to `maxBytes`,
 * plus the ORIGINAL size and SHA-256 and a truncation flag. Binary-safe —
 * the bytes are kept as bytes (a non-UTF-8 or NUL-containing value is
 * exactly the kind of record that gets parked).
 */
export function captureDeadLetterPayload(value: Buffer, maxBytes: number): DeadLetterPayload {
	const truncated: boolean = value.length > maxBytes;
	return {
		bytes: truncated ? value.subarray(0, maxBytes) : value,
		sizeBytes: value.length,
		sha256: createHash(PAYLOAD_HASH_ALGORITHM).update(value).digest("hex"),
		truncated,
	};
}

/** Caps an error message at `maxChars`, appending an explicit marker with the original length when it cuts. */
export function boundErrorText(text: string, maxChars: number = DEAD_LETTER_ERROR_MAX_CHARS): string {
	if (text.length <= maxChars) {
		return text;
	}
	const marker = ` … [truncated: ${String(text.length)} chars total]`;
	return `${text.slice(0, Math.max(0, maxChars - marker.length))}${marker}`;
}
