/** PostgreSQL text/varchar columns reject NUL (0x00) bytes. */
export function sanitizePostgresText(value: string, maxLength: number): string {
	let sanitized = "";
	for (const char of value) {
		if (char.charCodeAt(0) !== 0) {
			sanitized += char;
		}
	}
	if (sanitized.length <= maxLength) {
		return sanitized;
	}
	return sanitized.slice(0, maxLength);
}
