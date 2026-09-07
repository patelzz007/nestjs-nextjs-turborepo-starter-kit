/** Escape a string for safe embedding in generated TypeScript source. */
export function tsStringLiteral(value: string): string {
	return JSON.stringify(value);
}
