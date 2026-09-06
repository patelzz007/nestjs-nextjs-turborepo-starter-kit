/** Insert a generated block before a stable closing anchor without duplicating commas. */
export function insertBeforeAnchor(source: string, anchor: string, block: string): string {
	const index = source.lastIndexOf(anchor);
	if (index === -1) {
		throw new Error(`Could not locate patch anchor: ${anchor}`);
	}

	const before = source.slice(0, index).trimEnd();
	const needsComma = !before.endsWith(",") && !before.endsWith("{");
	const prefix = needsComma ? "," : "";
	return `${before}${prefix}\n${block}${source.slice(index)}`;
}
