// Each showcase component's API reference, read from the kit's real
// TypeScript (the web's apps/admin scripts/showcase-api.ts, for the React
// Native kit): the components, hooks and helpers the entry's kit modules
// export (`modules` in the app's showcase catalog), and for each component the
// props it declares itself (name, type, default, description), with what it
// inherits from React Native summarised in one line.
//
// Types and descriptions come from the type checker (TypeScript 7's
// `typescript/unstable/sync` API) and the JSDoc on each declaration; a default
// is the initializer of the destructured prop, or the `cva` default variant.
// Output: generated/api/<component>.ts (plain data) and generated/api/index.ts
// (each behind a dynamic import, so a docs screen loads only its own).

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import type { Node } from "typescript/unstable/ast";
import { isBindingElement, isCallExpression, isIdentifier, isObjectBindingPattern, isVariableDeclaration } from "typescript/unstable/ast/is";
import { API, SignatureKind, SymbolFlags, type Checker, type Project, type Symbol as TsSymbol, type Type } from "typescript/unstable/sync";

import { pascalCaseOf } from "./features.ts";
import type { ApiEntry, ApiEntryKind, ApiProp, ShowcaseCatalogComponent, ShowcaseLayout } from "./layout.ts";

/** A type longer than this is cut, with an ellipsis: the full type is one tap away in the source. */
const MAX_TYPE_LENGTH = 240;
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/u;
const HOOK_NAME = /^use[A-Z][A-Za-z0-9]*$/u;
const FUNCTION_NAME = /^[a-z][A-Za-z0-9]*$/u;
/** `cva()` style constants: documented through the component that uses them. */
const VARIANTS_SUFFIX = "Variants";
/** React contexts: plumbing between a component's parts, read through its hooks. */
const CONTEXT_SUFFIX = "Context";
const DEFAULT_VARIANTS = /defaultVariants:\s*\{(?<body>[^}]*)\}/u;
/** A constant's initializer worth showing in place of its name. */
const LITERAL_DEFAULT = /^(?:"[^"]*"|-?\d[\d_.]*|true|false|null)$/u;
const DEFAULT_VARIANT_ENTRY = /(?<key>[A-Za-z0-9_]+):\s*(?<value>"[^"]*"|true|false|\d+)/gu;
const NODE_MODULES = "/node_modules/";
const VARIANT_PACKAGE = "/class-variance-authority/";
const REACT_NATIVE_TYPES = "/react-native/";
const REACT_TYPES = "/@types/react/";
/** The kit folder a bare module name lives in (`button` → `components/button`). */
const COMPONENTS_FOLDER = "components";

export interface ComponentApi {
	readonly slug: string;
	readonly entries: readonly ApiEntry[];
}

/** A catalog module's path inside the kit: a bare name is a component (`components/button`), a path is itself (`lib/use-file-upload`). */
export function kitPathOf(module: string): string {
	return module.includes("/") ? module : `${COMPONENTS_FOLDER}/${module}`;
}

/** The kit file of a catalog module, or `null` when there is none. */
export function fileOfModule(layout: ShowcaseLayout, module: string): string | null {
	const base = path.join(layout.appRoot, layout.kitDir, kitPathOf(module));
	return [".tsx", ".ts"].map((extension: string): string => `${base}${extension}`).find((candidate: string): boolean => existsSync(candidate)) ?? null;
}

/** The one-line name of where an inherited prop comes from, or `null` to leave it out. */
export function inheritedFrom(declarationPath: string): string | null {
	if (declarationPath.includes(REACT_NATIVE_TYPES)) {
		return "React Native props";
	}
	return declarationPath.includes(REACT_TYPES) ? "React props" : null;
}

/** The `defaultVariants` of every `cva(...)` call in `source` — a key two calls disagree on is left out. */
export function cvaDefaultsOf(source: string): ReadonlyMap<string, string> {
	const found = new Map<string, Set<string>>();
	for (const block of source.split("cva(").slice(1)) {
		const body = DEFAULT_VARIANTS.exec(block)?.groups?.body ?? "";
		for (const entry of body.matchAll(DEFAULT_VARIANT_ENTRY)) {
			const key = entry.groups?.key ?? "";
			const values = found.get(key) ?? new Set<string>();
			values.add(entry.groups?.value ?? "");
			found.set(key, values);
		}
	}
	return new Map([...found].filter(([, values]): boolean => values.size === 1).map(([key, values]): [string, string] => [key, [...values].join("")]));
}

/** `text`, cut to `MAX_TYPE_LENGTH` with an ellipsis. */
export function clipType(text: string): string {
	const flat = text.replace(/\s+/gu, " ");
	return flat.length <= MAX_TYPE_LENGTH ? flat : `${flat.slice(0, MAX_TYPE_LENGTH - 1)}…`;
}

/** The JSDoc text as one paragraph. */
function oneParagraph(text: string): string {
	return text.replace(/\s+/gu, " ").trim();
}

/** The first `{ a = 1, b }` parameter pattern under `node`: where a component destructures its props. */
function propsPatternOf(node: Node): Node | undefined {
	return node.forEachChild((child: Node): Node | undefined => (isObjectBindingPattern(child) ? child : propsPatternOf(child)));
}

interface Extractor {
	readonly checker: Checker;
	readonly project: Project;
}

function targetOf({ checker }: Extractor, symbol: TsSymbol): TsSymbol {
	return (symbol.flags & SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
}

/** A default the reader can use as is: `2000` rather than `DEFAULT_COPY_FEEDBACK_MS`, when the constant is a plain literal. */
function defaultTextOf(extractor: Extractor, initializer: Node): string {
	const text = initializer.getText(initializer.getSourceFile());
	if (!isIdentifier(initializer)) {
		return text;
	}
	const symbol = extractor.checker.getSymbolAtLocation(initializer);
	const declaration = symbol === undefined ? undefined : targetOf(extractor, symbol).valueDeclaration?.resolve(extractor.project);
	if (declaration !== undefined && isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
		const value = declaration.initializer.getText(declaration.getSourceFile());
		return LITERAL_DEFAULT.test(value) ? value : text;
	}
	return text;
}

/** The defaults a component's props pattern gives, by prop name (source text). */
function patternDefaultsOf(extractor: Extractor, declaration: Node): ReadonlyMap<string, string> {
	const pattern = propsPatternOf(declaration);
	const defaults = new Map<string, string>();
	if (pattern === undefined || !isObjectBindingPattern(pattern)) {
		return defaults;
	}
	const sourceFile = declaration.getSourceFile();
	for (const element of pattern.elements) {
		const key = isBindingElement(element) ? (element.propertyName ?? element.name) : undefined;
		if (key !== undefined && isBindingElement(element) && element.initializer !== undefined) {
			defaults.set(key.getText(sourceFile), defaultTextOf(extractor, element.initializer));
		}
	}
	return defaults;
}

function kindOf(name: string): ApiEntryKind | null {
	if (name.endsWith(VARIANTS_SUFFIX) || name.endsWith(CONTEXT_SUFFIX)) {
		return null;
	}
	if (HOOK_NAME.test(name)) {
		return "hook";
	}
	if (COMPONENT_NAME.test(name)) {
		return "component";
	}
	return FUNCTION_NAME.test(name) ? "function" : null;
}

/** One prop row, or `null` when the prop is inherited (and recorded in `inherits`). */
function propOf(extractor: Extractor, prop: TsSymbol, defaults: ReadonlyMap<string, string>, inherits: Set<string>): ApiProp | null {
	const declarationPath = prop.declarations.at(0)?.path ?? "";
	if (declarationPath.includes(NODE_MODULES) && !declarationPath.includes(VARIANT_PACKAGE)) {
		const from = inheritedFrom(declarationPath);
		if (from !== null) {
			inherits.add(from);
		}
		return null;
	}
	const { checker } = extractor;
	const type = checker.getTypeOfSymbol(prop);
	const typeText = type === undefined ? "unknown" : checker.typeToString(type);
	const optional = (prop.flags & SymbolFlags.Optional) !== 0;
	return {
		name: prop.name,
		type: clipType(typeText.replace(/ \| undefined$/u, "")),
		defaultValue: defaults.get(prop.name) ?? null,
		description: oneParagraph(checker.getDocumentationCommentOfSymbol(prop)),
		required: !optional,
	};
}

function componentEntry(extractor: Extractor, name: string, moduleSpecifier: string, symbol: TsSymbol, type: Type): ApiEntry | null {
	const { checker, project } = extractor;
	const signature = checker.getSignaturesOfType(type, SignatureKind.Call).at(0);
	if (signature === undefined) {
		return null;
	}
	const declaration = symbol.valueDeclaration?.resolve(project);
	const sourceText = declaration?.getSourceFile().text ?? "";
	const defaults = new Map([...cvaDefaultsOf(sourceText), ...(declaration === undefined ? [] : patternDefaultsOf(extractor, declaration))]);
	const propsType = checker.getParameterType(signature, 0);
	const inherits = new Set<string>();
	const props =
		propsType === undefined
			? []
			: checker
					.getPropertiesOfType(propsType)
					.map((prop: TsSymbol): ApiProp | null => propOf(extractor, prop, defaults, inherits))
					.filter((prop: ApiProp | null): prop is ApiProp => prop !== null);
	return {
		name,
		kind: "component",
		module: moduleSpecifier,
		description: oneParagraph(checker.getDocumentationCommentOfSymbol(symbol)),
		props,
		inherits: [...inherits].sort(),
		signature: null,
	};
}

function callableEntry(extractor: Extractor, name: string, kind: ApiEntryKind, moduleSpecifier: string, symbol: TsSymbol, type: Type): ApiEntry | null {
	const { checker } = extractor;
	if (checker.getSignaturesOfType(type, SignatureKind.Call).length === 0) {
		return null;
	}
	return {
		name,
		kind,
		module: moduleSpecifier,
		description: oneParagraph(checker.getDocumentationCommentOfSymbol(symbol)),
		props: [],
		inherits: [],
		signature: clipType(checker.typeToString(type)),
	};
}

/** Whether a declaration is a `const x = cva(...)`, documented through its component instead. */
function isVariantsConstant(declaration: Node | undefined): boolean {
	return (
		declaration !== undefined &&
		isVariableDeclaration(declaration) &&
		declaration.initializer !== undefined &&
		isCallExpression(declaration.initializer) &&
		declaration.initializer.expression.getText(declaration.getSourceFile()) === "cva"
	);
}

function moduleEntries(extractor: Extractor, layout: ShowcaseLayout, module: string): ApiEntry[] {
	const file = fileOfModule(layout, module);
	if (file === null) {
		throw new Error(`showcase generator — the catalog names the kit module "${module}", which has no file in ${layout.kitDir}`);
	}
	const { checker, project } = extractor;
	const sourceFile = project.program.getSourceFile(file);
	const moduleSymbol = sourceFile === undefined ? undefined : checker.getSymbolAtLocation(sourceFile);
	if (moduleSymbol === undefined) {
		throw new Error(`showcase generator — ${file} is not part of ${layout.tsconfig}'s program`);
	}
	const moduleSpecifier = `${layout.kitAlias}${kitPathOf(module)}`;
	return checker
		.getExportsOfModule(moduleSymbol)
		.map((exported: TsSymbol): ApiEntry | null => {
			const kind = kindOf(exported.name);
			const symbol = targetOf(extractor, exported);
			if (kind === null || symbol.valueDeclaration === undefined || isVariantsConstant(symbol.valueDeclaration.resolve(project))) {
				return null;
			}
			const type = checker.getTypeOfSymbol(symbol);
			if (type === undefined) {
				return null;
			}
			return kind === "component"
				? componentEntry(extractor, exported.name, moduleSpecifier, symbol, type)
				: callableEntry(extractor, exported.name, kind, moduleSpecifier, symbol, type);
		})
		.filter((entry: ApiEntry | null): entry is ApiEntry => entry !== null);
}

const KIND_ORDER: Readonly<Record<ApiEntryKind, number>> = { component: 0, hook: 1, function: 2 };

/** Reading order: the component the screen is named after, its other components, then hooks, then helpers (module order within each). */
export function orderEntries(primary: string, entries: readonly ApiEntry[]): ApiEntry[] {
	const rank = (entry: ApiEntry): number => (entry.name === primary ? -1 : KIND_ORDER[entry.kind]);
	return entries
		.map((entry: ApiEntry, position: number): { entry: ApiEntry; position: number } => ({ entry, position }))
		.sort((left, right): number => rank(left.entry) - rank(right.entry) || left.position - right.position)
		.map(({ entry }): ApiEntry => entry);
}

/**
 * What the catalog misses, sorted: a kit component in no entry and not listed as left out (`notShown`), and a module
 * an entry names that has no file in the kit.
 */
export function catalogGaps(layout: ShowcaseLayout, catalog: readonly ShowcaseCatalogComponent[], notShown: readonly string[]): string[] {
	const named = catalog.flatMap((component: ShowcaseCatalogComponent): readonly string[] => component.modules);
	const covered = new Set([...named, ...notShown]);
	const unshown = readdirSync(path.join(layout.appRoot, layout.kitDir, COMPONENTS_FOLDER))
		.filter((file: string): boolean => file.endsWith(".tsx"))
		.map((file: string): string => file.slice(0, -".tsx".length))
		.filter((module: string): boolean => !covered.has(module))
		.map((module: string): string => `kit component "${module}" is in no catalog entry`);
	const missing = named
		.filter((module: string): boolean => fileOfModule(layout, module) === null)
		.map((module: string): string => `catalog module "${module}" has no kit file`);
	return [...unshown, ...missing].sort();
}

/** Every catalog component's API, from the type checker. Starts the TypeScript server once. */
export function extractComponentApis(layout: ShowcaseLayout, catalog: readonly ShowcaseCatalogComponent[]): ComponentApi[] {
	const tsconfig = path.join(layout.appRoot, layout.tsconfig);
	const api = new API({ cwd: path.dirname(tsconfig) });
	try {
		const snapshot = api.updateSnapshot({ openProjects: [tsconfig] });
		const project = snapshot.getProjects().at(0);
		if (project === undefined) {
			throw new Error(`showcase generator — no TypeScript project for ${layout.tsconfig}`);
		}
		const extractor: Extractor = { checker: project.checker, project };
		return catalog.map((entry: ShowcaseCatalogComponent): ComponentApi => {
			const seen = new Set<string>();
			const entries = entry.modules
				.flatMap((module: string): ApiEntry[] => moduleEntries(extractor, layout, module))
				.filter((apiEntry: ApiEntry): boolean => {
					if (seen.has(apiEntry.name)) {
						return false;
					}
					seen.add(apiEntry.name);
					return true;
				});
			return { slug: entry.slug, entries: orderEntries(entry.name || pascalCaseOf(entry.slug), entries) };
		});
	} finally {
		api.close();
	}
}

const GENERATED_HEADER = "// GENERATED by the showcase generator — do not edit by hand.";

/** One component's generated API module. */
export function apiModuleSource(componentApi: ComponentApi): string {
	return `${GENERATED_HEADER}
// The ${componentApi.slug} component's API reference, read from the kit's TypeScript.

import type { ApiEntry } from "../../showcase-api";

export const API_ENTRIES: readonly ApiEntry[] = ${JSON.stringify(componentApi.entries, null, "\t")};
`;
}

/** The index: every component's API module behind a dynamic import. */
export function apiIndexSource(slugs: readonly string[]): string {
	const rows = slugs.map((slug: string): string => `\t[${JSON.stringify(slug)}, async (): Promise<readonly ApiEntry[]> => (await import("./${slug}")).API_ENTRIES],`);
	return `${GENERATED_HEADER}
// Every component's API reference, each loaded only when its docs screen asks for it.

import type { ApiEntry } from "../../showcase-api";

export type LoadApiEntries = () => Promise<readonly ApiEntry[]>;

export const SHOWCASE_API: ReadonlyMap<string, LoadApiEntries> = new Map<string, LoadApiEntries>([
${rows.join("\n")}
]);
`;
}
