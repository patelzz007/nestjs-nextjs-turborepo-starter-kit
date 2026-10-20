// ============================================
// row-id.ts — the primary key of every new row: a UUID version 7 (RFC 9562)
// ============================================
// A v7 UUID starts with the creation time in milliseconds, so ids sort by
// creation and new rows land at the right-hand edge of a B-tree index instead
// of at random pages (v4). The rest is random. The database's own default for
// rows created by SQL is PostgreSQL 18's `uuidv7()`; Prisma's is `uuid(7)`.
// Web Crypto keeps this usable from Node, the browser and React Native alike.

/** Bytes in a UUID. */
const UUID_BYTES = 16;
/** Bytes the 48-bit Unix-millisecond timestamp occupies, at the start. */
const TIMESTAMP_BYTES = 6;
/** Bytes after the timestamp: the version and variant bits overwrite part of them, the rest stay random. */
export const ROW_ID_ENTROPY_BYTES = UUID_BYTES - TIMESTAMP_BYTES;
/** The timestamp's upper 16 bits sit at offset 0, its lower 32 bits at offset 2. */
const TIMESTAMP_HIGH_OFFSET = 0;
const TIMESTAMP_LOW_OFFSET = 2;
const TWO_POW_32 = 2 ** 32;
/** The largest time a 48-bit millisecond field holds. */
const MAX_TIMESTAMP_MS = 2 ** 48 - 1;
/** Byte 6 carries the version in its high nibble; byte 8 the variant in its two high bits. */
const VERSION_OFFSET = 6;
const VARIANT_OFFSET = 8;
const LOW_NIBBLE = 0x0f;
const VERSION_7 = 0x70;
const LOW_SIX_BITS = 0x3f;
const VARIANT_RFC_9562 = 0x80;
/** Hex digits per byte, and the 8-4-4-4-12 grouping of a UUID's 32 hex digits. */
const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;
const UUID_GROUPS = /^(?<a>[0-9a-f]{8})(?<b>[0-9a-f]{4})(?<c>[0-9a-f]{4})(?<d>[0-9a-f]{4})(?<e>[0-9a-f]{12})$/;

/** Thrown when a row id cannot be built from the given time or entropy. */
export class RowIdError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "RowIdError";
	}
}

/**
 * A UUID v7 from a creation time and {@link ROW_ID_ENTROPY_BYTES} bytes of entropy. {@link newRowId} passes
 * random bytes; a caller that needs a STABLE id (the seed: the same row on every re-seed) passes a hash.
 */
export function rowIdFrom(timestampMs: number, entropy: Uint8Array): string {
	if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 || timestampMs > MAX_TIMESTAMP_MS) {
		throw new RowIdError(`A row id timestamp must be a whole number of milliseconds within 48 bits, got ${String(timestampMs)}`);
	}
	if (entropy.length < ROW_ID_ENTROPY_BYTES) {
		throw new RowIdError(`A row id needs ${String(ROW_ID_ENTROPY_BYTES)} bytes of entropy, got ${String(entropy.length)}`);
	}
	const bytes = new Uint8Array(UUID_BYTES);
	bytes.set(entropy.subarray(0, ROW_ID_ENTROPY_BYTES), TIMESTAMP_BYTES);
	const view = new DataView(bytes.buffer);
	view.setUint16(TIMESTAMP_HIGH_OFFSET, Math.floor(timestampMs / TWO_POW_32));
	view.setUint32(TIMESTAMP_LOW_OFFSET, timestampMs % TWO_POW_32);
	view.setUint8(VERSION_OFFSET, (view.getUint8(VERSION_OFFSET) & LOW_NIBBLE) | VERSION_7);
	view.setUint8(VARIANT_OFFSET, (view.getUint8(VARIANT_OFFSET) & LOW_SIX_BITS) | VARIANT_RFC_9562);
	const hex = Array.from(bytes, (byte: number): string => byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, "0")).join("");
	const groups = UUID_GROUPS.exec(hex)?.groups;
	if (groups?.a === undefined || groups.b === undefined || groups.c === undefined || groups.d === undefined || groups.e === undefined) {
		throw new RowIdError("UUID bytes did not format as 32 hex digits");
	}
	return `${groups.a}-${groups.b}-${groups.c}-${groups.d}-${groups.e}`;
}

/** A new UUID v7 for a row created at `nowMs` (epoch ms; defaults to now). */
export function newRowId(nowMs: number = Date.now()): string {
	return rowIdFrom(nowMs, globalThis.crypto.getRandomValues(new Uint8Array(ROW_ID_ENTROPY_BYTES)));
}
