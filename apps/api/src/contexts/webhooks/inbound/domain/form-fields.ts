// The fields of a form body (`application/x-www-form-urlencoded`), parsed from the raw bytes a signature covers.
// A repeated field keeps its last value.

/** The fields of a form body, in order. */
export function formFields(rawBody: Buffer): ReadonlyMap<string, string> {
	return new Map(new URLSearchParams(rawBody.toString("utf8")).entries());
}
