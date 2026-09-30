/**
 * Parses the `{…}` range part of a code fence's meta string —
 * ` ```ts {2-4,7} ` → `[2, 3, 4, 7]`. Malformed parts are skipped.
 */
export function parseHighlightLines(meta: string): readonly number[] {
	const braces = /\{([^}]*)\}/.exec(meta);
	if (braces === null) {
		return [];
	}
	const lines: number[] = [];
	for (const rawPart of (braces[1] ?? "").split(",")) {
		const part = rawPart.trim();
		const range = /^(\d+)-(\d+)$/.exec(part);
		if (range !== null) {
			for (let line = Number(range[1]); line <= Number(range[2]); line += 1) {
				lines.push(line);
			}
		} else if (/^\d+$/.test(part)) {
			lines.push(Number(part));
		}
	}
	return lines;
}

/** Reads a `title="…"` from a fence meta string (shown in the code block header). */
export function parseCodeTitle(meta: string): string | null {
	const match = /title="([^"]*)"/.exec(meta);
	return match?.[1] ?? null;
}
