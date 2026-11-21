// Compares this repository's low-level kit with its copy in a sister repository (`nextjs-admin-dashboard-layout` for
// the web kit, `expo-boilerplate` for the mobile kit). The two must hold the same code: a file may differ only in its
// import specifiers (each repo names its own paths) and in the order its formatter gives the imports. Everything
// here is pure; the CLI reads the files.

/** One folder of this repository and where its copy lives in the other repository (both relative to their roots). */
export interface KitPathMapping {
	readonly from: string;
	readonly to: string;
}

/** One import-specifier prefix as this repository writes it, and as the other repository writes it. */
export interface KitSpecifierMapping {
	readonly from: string;
	readonly to: string;
}

/** A pair of repositories that keep the same kit. This repository's pairs are `kitPairs` in `tooling.config.ts`. */
export interface KitPair {
	readonly name: string;
	/** Most specific first: the first mapping whose `from` prefixes a path wins. */
	readonly paths: readonly KitPathMapping[];
	/** Most specific first, applied in order to every quoted specifier. */
	readonly specifiers: readonly KitSpecifierMapping[];
	/** Most specific first: the route prefix a Markdown link in the docs takes in each repository. */
	readonly links: readonly KitSpecifierMapping[];
}

/** Where a file of this repository lives in the other one, or `null` when it is outside every mapped folder. */
export function mapKitPath(relativePath: string, pair: KitPair): string | null {
	const mapping = pair.paths.find((candidate) => relativePath.startsWith(candidate.from));
	return mapping === undefined ? null : `${mapping.to}${relativePath.slice(mapping.from.length)}`;
}

/** A double-quoted string (where a specifier sits in code) or a backtick-quoted one (where a comment or doc names one). */
const QUOTED_TEXT = /(?<quote>["`])(?<content>[^"`\n]*)\k<quote>/gu;

/**
 * The text with every quoted specifier, and every quoted file path, rewritten the way the other repository writes it.
 * Each is rewritten once, by the first mapping whose prefix it starts with (specifiers before folders), so one
 * mapping's output is never fed to the next.
 */
export function mapKitSpecifiers(text: string, pair: KitPair): string {
	const mappings: readonly KitSpecifierMapping[] = [...pair.specifiers, ...pair.paths];
	return text.replace(QUOTED_TEXT, (quoted: string, quote: string, content: string): string => {
		const mapping = mappings.find((candidate) => content.startsWith(candidate.from));
		return mapping === undefined ? quoted : `${quote}${mapping.to}${content.slice(mapping.from.length)}${quote}`;
	});
}

/** A Markdown link's target: `[text](target)`. */
const MARKDOWN_LINK_TARGET = /\]\((?<target>[^)\s]+)\)/gu;

/** The text with every Markdown link to the showcase pointed at the other repository's route. */
export function mapKitLinks(text: string, pair: KitPair): string {
	return text.replace(MARKDOWN_LINK_TARGET, (link: string, target: string): string => {
		const mapping = pair.links.find((candidate) => target.startsWith(candidate.from));
		return mapping === undefined ? link : `](${mapping.to}${target.slice(mapping.from.length)})`;
	});
}

/** Import and re-export statements, one or many lines each. */
const IMPORT_STATEMENT = /^(?:import|export)\b[^;]*?\bfrom\s+"[^"]+";[ \t]*\n?|^import\s+"[^"]+";[ \t]*\n?/gmu;

/** The text without its import and re-export statements: what remains must be identical in both repositories. */
export function stripKitImports(text: string): string {
	return text.replace(IMPORT_STATEMENT, "");
}

/** A trailing comma before a closing brace: a formatter adds one when it wraps a long import over several lines. */
const TRAILING_COMMA = /,\s*\}/gu;

/**
 * The import and re-export statements, sorted: the same set in both repositories, whatever order a formatter gives,
 * and whether or not it wraps a statement over several lines (each repository's specifiers have their own length).
 */
export function kitImportSet(text: string): readonly string[] {
	return [...text.matchAll(IMPORT_STATEMENT)].map(([statement]) => statement.replace(/\s+/gu, " ").replace(TRAILING_COMMA, " }").trim()).sort();
}

/**
 * A file of this repository as the other repository holds it: every specifier, quoted path and showcase link written
 * the other repository's way. `kit:compare --sync` writes this to the copy; the other repository's formatter then
 * orders its imports.
 */
export function kitCopyOf(source: string, pair: KitPair): string {
	return mapKitLinks(mapKitSpecifiers(source, pair), pair);
}

export type KitFileStatus = "same" | "different" | "missing";

/**
 * How a file of this repository compares with its copy: `same` when, with this repository's specifiers written the
 * other repository's way, the code outside the imports is identical and the imports are the same set; `missing`
 * when the copy does not exist.
 */
export function compareKitFile(source: string, copy: string | null, pair: KitPair): KitFileStatus {
	if (copy === null) {
		return "missing";
	}
	const mapped = kitCopyOf(source, pair);
	if (mapped === copy) {
		return "same";
	}
	const sameBody = stripKitImports(mapped) === stripKitImports(copy);
	const sameImports = kitImportSet(mapped).join("\n") === kitImportSet(copy).join("\n");
	return sameBody && sameImports ? "same" : "different";
}

/** One compared file and its status. */
export interface KitFileReport {
	readonly path: string;
	readonly copyPath: string;
	readonly status: KitFileStatus;
}

/** The files that are not the same, missing ones first, each group in path order. */
export function kitDrift(reports: readonly KitFileReport[]): readonly KitFileReport[] {
	const order: Readonly<Record<KitFileStatus, number>> = { missing: 0, different: 1, same: 2 };
	return reports.filter((report) => report.status !== "same").sort((left, right) => order[left.status] - order[right.status] || left.path.localeCompare(right.path));
}
