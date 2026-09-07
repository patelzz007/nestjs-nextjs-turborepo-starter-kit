const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
	box: "boxes",
	category: "categories",
};

function endsWithAny(value: string, suffixes: readonly string[]): boolean {
	return suffixes.some((suffix) => value.endsWith(suffix));
}

/** Convert a camelCase field name into a human-readable label. */
export function humanizeFieldLabel(camelName: string): string {
	const spaced = camelName.replace(/([A-Z])/g, " $1").trim();
	return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

/** Pluralize a singular English label with common inflection rules. */
export function pluralizeLabel(singular: string): string {
	const lower = singular.toLowerCase();
	const irregular = IRREGULAR_PLURALS[lower];
	if (irregular !== undefined) {
		return irregular;
	}
	if (lower.endsWith("y") && singular.length > 1 && !endsWithAny(lower.slice(0, -1), ["a", "e", "i", "o", "u"])) {
		return `${singular.slice(0, -1)}ies`;
	}
	if (endsWithAny(lower, ["s", "x", "z", "ch", "sh"])) {
		return `${singular}es`;
	}
	return `${singular}s`;
}
