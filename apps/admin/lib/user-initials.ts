/**
 * Derives up-to-two-letter initials from a full name ("Alex Morgan" → "AM").
 * Handles single-word names and empty strings gracefully.
 */
export function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	const firstPart = parts[0];
	const lastPart = parts.length > 1 ? parts[parts.length - 1] : undefined;
	const firstInitial = firstPart !== undefined ? firstPart.charAt(0) : "";
	const lastInitial = lastPart !== undefined ? lastPart.charAt(0) : "";
	return `${firstInitial}${lastInitial}`.toUpperCase();
}
