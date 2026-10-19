/** Every HTML tag (`<b>`, `</script>`, `<img src=x>`): stripped from a free-text geo name. */
const HTML_TAG_PATTERN = /<[^>]*>/g;

/** Strip HTML tags and trim a free-text geo name. */
export function sanitizeGeoName(value: string): string {
	return value.replace(HTML_TAG_PATTERN, "").trim();
}

/** A create/update input with its `name` (when present) sanitized — a NEW object, the input is never mutated. */
export function withSanitizedGeoName<TInput extends { readonly name?: string | undefined }>(input: TInput): TInput {
	return input.name === undefined ? input : { ...input, name: sanitizeGeoName(input.name) };
}
