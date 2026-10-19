/** Strip path segments and unsafe characters from an uploaded file name. */
export function sanitizeFileName(fileName: string): string {
	const baseName = fileName.split(/[/\\]/).pop() ?? "document";
	const sanitized = baseName.replace(/[^\w.\-() ]+/g, "_").trim();
	if (sanitized.length === 0) {
		return "document";
	}
	return sanitized.slice(0, 200);
}
