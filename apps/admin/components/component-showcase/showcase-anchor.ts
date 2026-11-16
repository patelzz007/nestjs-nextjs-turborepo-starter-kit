/** A URL fragment for a label: "Diagnostics & Actions" → `diagnostics-actions`. */
export function anchorOf(label: string): string {
	return label
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "");
}
