/**
 * Parses the `{…}` range part of a code fence's meta string —
 * ` ```ts {2-4,7} ` → `[2, 3, 4, 7]`. Malformed parts are skipped.
 */
export function parseHighlightLines(meta: string): readonly number[] {
	const braces = /\{(?<spec>[^}]*)\}/.exec(meta);
	if (braces === null) {
		return [];
	}
	const lines: number[] = [];
	for (const rawPart of (braces.groups?.spec ?? "").split(",")) {
		const part = rawPart.trim();
		const range = /^(?<start>\d+)-(?<end>\d+)$/.exec(part);
		if (range !== null) {
			for (let line = Number(range.groups?.start); line <= Number(range.groups?.end); line += 1) {
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
	const match = /title="(?<title>[^"]*)"/.exec(meta);
	return match?.groups?.title ?? null;
}
