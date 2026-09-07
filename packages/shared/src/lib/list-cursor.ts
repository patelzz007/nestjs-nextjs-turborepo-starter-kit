/** Encode a stable row id into an opaque list cursor. */
export function encodeListCursor(id: string): string {
	return Buffer.from(id, "utf-8").toString("base64url");
}

/** Decode an opaque list cursor back to a row id. Returns null when invalid. */
export function decodeListCursor(cursor: string): string | null {
	try {
		const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
		return decoded.length > 0 ? decoded : null;
	} catch {
		return null;
	}
}
