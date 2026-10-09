// ============================================
// generator/css.ts — a minimal CSS tree and its printer
// ============================================
// The generator builds rules and declarations as data and prints them here, in
// one fixed layout (tab indent, one declaration per line, a blank line between
// top-level rules, a trailing newline), so output never depends on how a
// renderer happened to concatenate strings.

/** `--<name>: <value>;` */
export interface CssDeclaration {
	readonly kind: "declaration";
	/** The custom-property name without the leading `--`. */
	readonly name: string;
	readonly value: string;
}

/** `<selector> { … }` — a style rule or an at-rule block (`@theme inline`, `@layer theme`, `@variant dark`). */
export interface CssRule {
	readonly kind: "rule";
	readonly selector: string;
	readonly children: readonly CssNode[];
}

export type CssNode = CssDeclaration | CssRule;

const INDENT = "\t";

/** Thrown when one block would declare the same custom property twice (the later one would silently win). */
export class DuplicateCssDeclarationError extends Error {
	public constructor(
		public readonly selector: string,
		public readonly duplicateNames: readonly string[],
	) {
		super(`"${selector}" declares ${duplicateNames.map((name) => `--${name}`).join(", ")} more than once`);
		this.name = "DuplicateCssDeclarationError";
	}
}

export function declaration(name: string, value: string): CssDeclaration {
	return { kind: "declaration", name, value };
}

export function rule(selector: string, children: readonly CssNode[]): CssRule {
	return { kind: "rule", selector, children };
}

/** The custom-property names declared directly in a rule (not in nested rules). */
export function declaredNames(target: CssRule): readonly string[] {
	return target.children.flatMap((child) => (child.kind === "declaration" ? [child.name] : []));
}

function assertUniqueDeclarations(target: CssRule): void {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const name of declaredNames(target)) {
		if (seen.has(name)) {
			duplicates.add(name);
		}
		seen.add(name);
	}
	if (duplicates.size > 0) {
		throw new DuplicateCssDeclarationError(target.selector, [...duplicates]);
	}
}

function printNode(node: CssNode, depth: number): readonly string[] {
	const indent = INDENT.repeat(depth);
	if (node.kind === "declaration") {
		return [`${indent}--${node.name}: ${node.value};`];
	}
	assertUniqueDeclarations(node);
	return [`${indent}${node.selector} {`, ...node.children.flatMap((child) => printNode(child, depth + 1)), `${indent}}`];
}

/** A `/* … *\/` block comment, one ` * ` line per entry. */
export function printComment(lines: readonly string[]): string {
	return ["/*", ...lines.map((line) => (line === "" ? " *" : ` * ${line}`)), " */"].join("\n");
}

/** The whole stylesheet: the header comment, then each top-level rule separated by a blank line, ending in a newline. */
export function printStylesheet(header: readonly string[], rules: readonly CssRule[]): string {
	const blocks = [printComment(header), ...rules.map((topLevel) => printNode(topLevel, 0).join("\n"))];
	return `${blocks.join("\n\n")}\n`;
}
