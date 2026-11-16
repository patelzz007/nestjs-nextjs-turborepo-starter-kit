// `pnpm showcase:generate` writes each showcase component's API reference from the
// kit's real TypeScript: the components, hooks and helpers its modules export,
// and for each component the props it declares itself (name, type, default,
// description), with what it inherits summarised in one line.
//
// - Which modules: the kit modules a component's examples import that belong to
//   it (`<kit>/<slug>.tsx`, `<kit>/<slug>-*.tsx`, or anything under
//   `<kit>/<slug>/`, where `<kit>` is `KIT_LAYOUT.componentsDir`), or the list
//   in its folder's `api.json`.
// - Types and descriptions come from the type checker (TypeScript 7's
//   `typescript/unstable/sync` API) and the JSDoc on each declaration; a default
//   is the initializer of the destructured prop, or the `cva` default variant.
// - Output: generated/api/<component>.ts (plain data) and generated/api/index.ts
//   (each behind a dynamic import, so a docs page loads only its own).
//
// The showcase test checks the committed files match what this produces.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Node } from "typescript/unstable/ast";
import { isBindingElement, isCallExpression, isIdentifier, isObjectBindingPattern, isVariableDeclaration } from "typescript/unstable/ast/is";
import { API, SignatureKind, SymbolFlags, type Checker, type Project, type Symbol as TsSymbol, type Type } from "typescript/unstable/sync";
import { z } from "zod";

import { EXAMPLES_DIR, GENERATED_DIR, pascalCaseOf } from "./showcase-features.ts";

/** The generated API modules, relative to the repository root. */
export const API_DIR = `${GENERATED_DIR}/api`;
export const API_INDEX_FILE = `${API_DIR}/index.ts`;

/** Where the kit lives, and the alias its consumers import it by. */
export interface KitLayout {
	/** Folder of the kit's components, relative to the repository root. */
	readonly componentsDir: string;
	/** The import specifier prefix that resolves to `componentsDir`. */
	readonly componentsAlias: string;
	/** Other kit folders an `api.json` may name (hooks), by alias → folder. */
	readonly otherAliases: Readonly<Record<string, string>>;
	/** The tsconfig whose program type-checks the kit. */
	readonly tsconfig: string;
	/** The alias the generated modules import the showcase from. */
	readonly showcaseAlias: string;
}

export const KIT_LAYOUT: KitLayout = {
	// The kit is the workspace's `@workspace/ui` package, beside this app.
	componentsDir: "../../packages/ui/src/components",
	componentsAlias: "@workspace/ui/components/",
	otherAliases: { "@workspace/ui/hooks/": "../../packages/ui/src/hooks/" },
	tsconfig: "tsconfig.json",
	showcaseAlias: "@/components/component-showcase",
};

/** A type longer than this is cut, with an ellipsis: the full type is one click away in the source. */
const MAX_TYPE_LENGTH = 240;
const API_OVERRIDE = "api.json";
const IMPORT_SPECIFIER = /from\s+"(?<specifier>[^"]+)"/gu;
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
const BASE_UI_PART = /\/@base-ui\/react\/(?:esm\/|cjs\/)?(?<part>[a-z-]+)\//u;
/** Base UI's shared plumbing: its props are the element's, not a part's. */
const BASE_UI_PLUMBING = new Set(["internals", "utils", "use-render", "merge-props", "types"]);
const REACT_TYPES = "/@types/react/";

const ApiOverrideSchema = z.strictObject({
	/** Kit modules by import specifier, e.g. `@workspace/ui/hooks/use-file-upload`. */
	modules: z.array(z.string().min(1)).min(1),
});

export type ApiEntryKind = "component" | "hook" | "function";

export interface ApiProp {
	readonly name: string;
	readonly type: string;
	/** The default as source text (`"default"`, `false`), or `null` when there is none. */
	readonly defaultValue: string | null;
	readonly description: string;
	readonly required: boolean;
}

export interface ApiEntry {
	readonly name: string;
	readonly kind: ApiEntryKind;
	/** The specifier to import it from, e.g. `@workspace/ui/components/code-block`. */
	readonly module: string;
	readonly description: string;
	/** A component's own props (empty for hooks and helpers). */
	readonly props: readonly ApiProp[];
	/** What else a component accepts, e.g. `Base UI Button props`, `HTML attributes`. */
	readonly inherits: readonly string[];
	/** A hook's or helper's call signature; `null` for components. */
	readonly signature: string | null;
}

export interface ComponentApi {
	readonly slug: string;
	readonly entries: readonly ApiEntry[];
}

/** A kit module of `slug`: its own file, a `<slug>-…` sibling, or a file in its folder. */
export function belongsTo(slug: string, modulePath: string): boolean {
	const [first, second] = modulePath.split("/");
	if (second !== undefined) {
		return first === slug;
	}
	return first === slug || (first ?? "").startsWith(`${slug}-`);
}

/** The kit module specifiers `source` imports (`@workspace/ui/components/x` → `x`). */
export function kitImportsOf(source: string, layout: KitLayout): string[] {
	return [...source.matchAll(IMPORT_SPECIFIER)]
		.map((match): string => match.groups?.specifier ?? "")
		.filter((specifier: string): boolean => specifier.startsWith(layout.componentsAlias))
		.map((specifier: string): string => specifier.slice(layout.componentsAlias.length));
}

/** The modules documented for `slug`, as import specifiers: the ones its examples import that belong to it. */
export function apiModulesOf(slug: string, exampleSources: readonly string[], layout: KitLayout): string[] {
	const modules = new Set(
		exampleSources.flatMap((source: string): string[] => kitImportsOf(source, layout)).filter((modulePath: string): boolean => belongsTo(slug, modulePath)),
	);
	return [...modules].sort().map((modulePath: string): string => `${layout.componentsAlias}${modulePath}`);
}

/** The repository-relative file an import specifier names, or `null` outside the kit. */
export function fileOfSpecifier(root: string, specifier: string, layout: KitLayout): string | null {
	const aliases: readonly [string, string][] = [[layout.componentsAlias, `${layout.componentsDir}/`], ...Object.entries(layout.otherAliases)];
	for (const [alias, folder] of aliases) {
		if (specifier.startsWith(alias)) {
			const base = path.join(root, folder, specifier.slice(alias.length));
			const file = [".tsx", ".ts", "/index.tsx", "/index.ts"]
				.map((extension: string): string => `${base}${extension}`)
				.find((candidate: string): boolean => existsSync(candidate));
			return file ?? null;
		}
	}
	return null;
}

/** The one-line name of where an inherited prop comes from, or `null` to leave it out. */
export function inheritedFrom(declarationPath: string): string | null {
	const basePart = BASE_UI_PART.exec(declarationPath)?.groups?.part;
	if (basePart !== undefined) {
		return BASE_UI_PLUMBING.has(basePart) ? "HTML attributes" : `Base UI ${basePart} props`;
	}
	return declarationPath.includes(REACT_TYPES) ? "HTML attributes" : null;
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

interface Extractor {
	readonly checker: Checker;
	readonly project: Project;
}

function targetOf({ checker }: Extractor, symbol: TsSymbol): TsSymbol {
	return (symbol.flags & SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
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

function moduleEntries(extractor: Extractor, root: string, moduleSpecifier: string, layout: KitLayout): ApiEntry[] {
	const file = fileOfSpecifier(root, moduleSpecifier, layout);
	if (file === null) {
		throw new Error(`showcase:generate — ${moduleSpecifier} does not resolve to a kit file`);
	}
	const { checker, project } = extractor;
	const sourceFile = project.program.getSourceFile(file);
	const moduleSymbol = sourceFile === undefined ? undefined : checker.getSymbolAtLocation(sourceFile);
	if (moduleSymbol === undefined) {
		throw new Error(`showcase:generate — ${file} is not part of ${layout.tsconfig}'s program`);
	}
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

/** The modules each component documents: its `api.json`, or the ones its examples import. */
export function readApiModules(root: string, layout: KitLayout): ReadonlyMap<string, readonly string[]> {
	const dir = path.join(root, EXAMPLES_DIR);
	const slugs = readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name !== "__tests__")
		.map((entry) => entry.name)
		.sort();
	return new Map(
		slugs.map((slug: string): [string, readonly string[]] => {
			const override = path.join(dir, slug, API_OVERRIDE);
			if (existsSync(override)) {
				const parsed = ApiOverrideSchema.safeParse(JSON.parse(readFileSync(override, "utf8")));
				if (!parsed.success) {
					throw new Error(`${EXAMPLES_DIR}/${slug}/${API_OVERRIDE}: ${parsed.error.message}`);
				}
				return [slug, parsed.data.modules];
			}
			const sources = readdirSync(path.join(dir, slug))
				.filter((name: string): boolean => name.endsWith(".tsx"))
				.map((name: string): string => readFileSync(path.join(dir, slug, name), "utf8"));
			return [slug, apiModulesOf(slug, sources, layout)];
		}),
	);
}

const KIND_ORDER: Readonly<Record<ApiEntryKind, number>> = { component: 0, hook: 1, function: 2 };

/** Reading order: the component the page is named after, its other components, then hooks, then helpers (module order within each). */
export function orderEntries(slug: string, entries: readonly ApiEntry[]): ApiEntry[] {
	const primary = pascalCaseOf(slug);
	const rank = (entry: ApiEntry): number => (entry.name === primary ? -1 : KIND_ORDER[entry.kind]);
	return entries
		.map((entry: ApiEntry, position: number): { entry: ApiEntry; position: number } => ({ entry, position }))
		.sort((left, right): number => rank(left.entry) - rank(right.entry) || left.position - right.position)
		.map(({ entry }): ApiEntry => entry);
}

/** Every component's API, from the type checker. Spawns the TypeScript server once. */
export function extractComponentApis(root: string, modulesBySlug: ReadonlyMap<string, readonly string[]>, layout: KitLayout): ComponentApi[] {
	const api = new API({ cwd: root });
	try {
		const snapshot = api.updateSnapshot({ openProjects: [path.join(root, layout.tsconfig)] });
		const project = snapshot.getProjects().at(0);
		if (project === undefined) {
			throw new Error(`showcase:generate — no TypeScript project for ${layout.tsconfig}`);
		}
		const extractor: Extractor = { checker: project.checker, project };
		return [...modulesBySlug].map(([slug, modules]): ComponentApi => {
			const seen = new Set<string>();
			const entries = modules
				.flatMap((moduleSpecifier: string): ApiEntry[] => moduleEntries(extractor, root, moduleSpecifier, layout))
				.filter((entry: ApiEntry): boolean => {
					if (seen.has(entry.name)) {
						return false;
					}
					seen.add(entry.name);
					return true;
				});
			return { slug, entries: orderEntries(slug, entries) };
		});
	} finally {
		api.close();
	}
}

/** One component's generated API module. */
export function apiModuleSource(componentApi: ComponentApi, layout: KitLayout): string {
	return `// GENERATED by \`pnpm showcase:generate\` — do not edit by hand.
// The ${componentApi.slug} component's API reference, read from the kit's TypeScript.

import type { ApiEntry } from "${layout.showcaseAlias}/showcase-api";

export const API_ENTRIES: readonly ApiEntry[] = ${JSON.stringify(componentApi.entries, null, "\t")};
`;
}

/** The index: every component's API module behind a dynamic import. */
export function apiIndexSource(slugs: readonly string[], layout: KitLayout): string {
	const rows = slugs.map(
		(slug: string): string =>
			`\t[${JSON.stringify(slug)}, async (): Promise<readonly ApiEntry[]> => (await import("${layout.showcaseAlias}/generated/api/${slug}")).API_ENTRIES],`,
	);
	return `// GENERATED by \`pnpm showcase:generate\` — do not edit by hand.
// Every component's API reference, each loaded only when its docs page asks for it.

import type { ApiEntry } from "${layout.showcaseAlias}/showcase-api";

export type LoadApiEntries = () => Promise<readonly ApiEntry[]>;

export const SHOWCASE_API: ReadonlyMap<string, LoadApiEntries> = new Map<string, LoadApiEntries>([
${rows.join("\n")}
]);
`;
}

function writeApiModules(root: string, layout: KitLayout): void {
	const apis = extractComponentApis(root, readApiModules(root, layout), layout);
	const dir = path.join(root, API_DIR);
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	for (const componentApi of apis) {
		writeFileSync(path.join(dir, `${componentApi.slug}.ts`), apiModuleSource(componentApi, layout));
	}
	writeFileSync(
		path.join(root, API_INDEX_FILE),
		apiIndexSource(
			apis.map(({ slug }): string => slug),
			layout,
		),
	);
	const entryCount = apis.reduce((total: number, { entries }: ComponentApi): number => total + entries.length, 0);
	process.stdout.write(`showcase api: ${String(apis.length)} components, ${String(entryCount)} entries\n`);
}

if (import.meta.main) {
	writeApiModules(process.cwd(), KIT_LAYOUT);
}
