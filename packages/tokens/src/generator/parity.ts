// ============================================
// generator/parity.ts — every theme defines every variable
// ============================================
// Uniwind only warns (in development) when a theme lacks a variable another
// theme defines, and on the web a missing `.dark` value silently falls back to
// the light one. The generator makes either a hard failure, for both outputs.

/** Thrown when at least one theme lacks a variable another theme defines. */
export class ThemeParityError extends Error {
	public constructor(
		public readonly output: string,
		public readonly problems: readonly string[],
	) {
		super(`${output}: every theme must define the same variables.\n${problems.join("\n")}`);
		this.name = "ThemeParityError";
	}
}

/**
 * One line per variable a theme is missing, as `<theme> is missing --<name>`;
 * empty when every theme defines exactly the same set. Sorted, so the report is
 * stable.
 */
export function findMissingThemeVariables(themes: ReadonlyMap<string, readonly string[]>): readonly string[] {
	const everyName = new Set([...themes.values()].flat());
	const problems = [...themes.entries()].flatMap(([theme, names]) => {
		const defined = new Set(names);
		return [...everyName].filter((name) => !defined.has(name)).map((name) => `${theme} is missing --${name}`);
	});
	return problems.sort(compareCodeUnits);
}

/** Orders strings by UTF-16 code units — unlike `localeCompare`, identical on every machine and locale. */
function compareCodeUnits(left: string, right: string): number {
	if (left === right) {
		return 0;
	}
	return left < right ? -1 : 1;
}

/** Throws a `ThemeParityError` naming every missing variable, for the output being generated. */
export function assertThemeParity(output: string, themes: ReadonlyMap<string, readonly string[]>): void {
	const problems = findMissingThemeVariables(themes);
	if (problems.length > 0) {
		throw new ThemeParityError(output, problems);
	}
}
