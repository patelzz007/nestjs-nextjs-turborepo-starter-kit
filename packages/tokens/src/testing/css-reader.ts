// ============================================
// testing/css-reader.ts — read declarations back out of generated CSS (tests only)
// ============================================
// Relies on the generator's fixed layout (css.ts): every block opens with
// `<indent><selector> {` on its own line and closes with `<indent>}`.

const DECLARATION_PATTERN = /^\t*--(?<name>[\w-]+): (?<value>.+);$/u;

/** The custom properties declared directly inside the first `<selector> {` block (nested blocks excluded), in order. */
export function readDeclarations(css: string, selector: string): ReadonlyMap<string, string> {
	const lines = css.split("\n");
	const openIndex = lines.findIndex((line) => line.trim() === `${selector} {`);
	const openLine = lines.at(openIndex);
	if (openIndex === -1 || openLine === undefined) {
		throw new Error(`No "${selector}" block in the stylesheet`);
	}
	const indent = openLine.slice(0, openLine.length - openLine.trimStart().length);
	const ownDepthPrefix = `${indent}\t`;
	const declarations = new Map<string, string>();
	for (const line of lines.slice(openIndex + 1)) {
		if (line === `${indent}}`) {
			return declarations;
		}
		const match = DECLARATION_PATTERN.exec(line);
		const isOwnDepth = line.startsWith(ownDepthPrefix) && !line.startsWith(`${ownDepthPrefix}\t`);
		if (match?.groups !== undefined && isOwnDepth) {
			declarations.set(match.groups.name ?? "", match.groups.value ?? "");
		}
	}
	throw new Error(`The "${selector}" block is never closed`);
}
