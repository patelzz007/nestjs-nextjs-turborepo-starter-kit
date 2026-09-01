/** Derive one or two uppercase initials from a display name. */
export function getUserInitials(name: string): string {
	const parts = name
		.trim()
		.split(/\s+/)
		.filter((part) => part.length > 0);
	if (parts.length === 0) {
		return "?";
	}
	if (parts.length === 1) {
		const first = parts[0];
		return first !== undefined ? first.slice(0, 2).toUpperCase() : "?";
	}
	const first = parts[0];
	const last = parts[parts.length - 1];
	const firstChar = first !== undefined && first.length > 0 ? first.charAt(0) : "";
	const lastChar = last !== undefined && last.length > 0 ? last.charAt(0) : "";
	return `${firstChar}${lastChar}`.toUpperCase();
}
