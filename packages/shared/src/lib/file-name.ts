/** Characters kept in a file-name segment; any run of anything else becomes one `-`. */
const UNSAFE_FILE_NAME_SEGMENT = /[^a-z0-9-]+/g;
/** Leading and trailing dashes left over after cleaning. */
const EDGE_DASHES = /^-+|-+$/g;
/** Longest segment kept by default. */
export const DEFAULT_FILE_NAME_SEGMENT_MAX_LENGTH = 64;

/**
 * `value` as a file-name segment that is safe on every OS and inside a
 * `Content-Disposition` header: lower-cased, only `[a-z0-9-]`, at most
 * `maxLength` characters — or `fallback` when nothing is left
 * (`"Weekend Brunch: 20% off!"` → `"weekend-brunch-20-off"`).
 */
export function safeFileNameSegment(value: string, fallback: string, maxLength: number = DEFAULT_FILE_NAME_SEGMENT_MAX_LENGTH): string {
	const cleaned = value.toLowerCase().replace(UNSAFE_FILE_NAME_SEGMENT, "-").replace(EDGE_DASHES, "").slice(0, maxLength).replace(EDGE_DASHES, "");
	return cleaned.length > 0 ? cleaned : fallback;
}
