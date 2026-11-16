/** A URL-safe id for a label: "Diagnostics & Actions" → `diagnostics-actions` (the web showcase's anchors). */
export function anchorOf(label: string): string {
	return label
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "");
}
