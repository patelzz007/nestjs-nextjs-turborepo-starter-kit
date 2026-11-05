/** Characters that must be escaped in HTML text and double-quoted attribute values. */
const HTML_ESCAPES: Readonly<Record<string, string>> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

/** Escapes a string for safe use as HTML text or a double-quoted attribute value. */
export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}
