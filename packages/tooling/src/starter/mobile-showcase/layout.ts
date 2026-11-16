// What the showcase generator needs from the app it generates for: where the
// showcase and the kit are, the app's conventions (anchors, the docs' fenced
// blocks) and its catalog. The app owns all of these and passes them in (its
// scripts/showcase.ts), so the generator never imports the app: the starter
// kit (apps/mobile + packages/ui-native) and expo-boilerplate (src/ + src/ui)
// run the same generator with their own layout.
//
// The data types below are what the generator writes into the generated
// modules. The app declares the same shapes (showcase-api.ts,
// showcase-content.ts) and types the generated modules with its own, so the
// app's type check fails if the two ever drift apart.

/** Where the showcase and the kit are, relative to the app's root, and the app's conventions. */
export interface ShowcaseLayout {
	/** The app's root: every path below is relative to it. */
	readonly appRoot: string;
	/** The examples, one folder per component. */
	readonly examplesDir: string;
	/** The generated modules. */
	readonly generatedDir: string;
	/** The kit's source folder (`components/`, `lib/` inside). */
	readonly kitDir: string;
	/** The specifier prefix the app imports the kit by (`@workspace/ui-native/` + `components/button`). */
	readonly kitAlias: string;
	/** The tsconfig whose program type-checks the kit (relative to the app's root). */
	readonly tsconfig: string;
	/** The app's anchor for a label ("Diagnostics & Actions" → `diagnostics-actions`). */
	readonly anchorOf: (label: string) => string;
	/** The fenced-block languages of a docs page: the API reference's, and one example's (its body is the example's id). */
	readonly fences: ShowcaseFences;
}

/** The layout as an app hands it over: its root as a file URL (`new URL("..", import.meta.url)`), so the app needs no Node module. */
export interface ShowcaseAppLayout extends Omit<ShowcaseLayout, "appRoot"> {
	readonly appUrl: URL;
}

export interface ShowcaseFences {
	readonly api: string;
	readonly example: string;
}

/** One catalog component, as the generator reads it. */
export interface ShowcaseCatalogComponent {
	/** The component's folder of examples and its page. */
	readonly slug: string;
	/** The component's exported name. */
	readonly name: string;
	/** The kit modules whose exports make up its API, its main one first (`button`, `lib/use-file-upload`). */
	readonly modules: readonly string[];
}

// ── What the generated modules hold ────────────────────────────────────────

export type ApiEntryKind = "component" | "hook" | "function";

/** One prop a component declares itself. */
export interface ApiProp {
	readonly name: string;
	readonly type: string;
	/** The default as source text (`"md"`, `false`), or `null` when there is none. */
	readonly defaultValue: string | null;
	readonly description: string;
	readonly required: boolean;
}

/** One export: a component with its props, or a hook / helper with its signature. */
export interface ApiEntry {
	readonly name: string;
	readonly kind: ApiEntryKind;
	/** The specifier to import it from, e.g. `@workspace/ui-native/components/code-block`. */
	readonly module: string;
	readonly description: string;
	readonly props: readonly ApiProp[];
	/** What else a component accepts, e.g. `React Native view props`. */
	readonly inherits: readonly string[];
	/** A hook's or helper's call signature; `null` for components. */
	readonly signature: string | null;
}

/** One question of a component's FAQ, its answer in Markdown. */
export interface ShowcaseFaqEntry {
	readonly question: string;
	readonly answer: string;
}

/** The component screen's prose: when to reach for it, an overview, and its FAQ. Every list item is inline Markdown. */
export interface ShowcaseOverview {
	readonly whenToUse: readonly string[];
	readonly whenNotToUse: readonly string[];
	readonly notes: readonly string[];
	/** The overview sections (`##` and `###`), in Markdown. */
	readonly body: string;
	readonly faq: readonly ShowcaseFaqEntry[];
}

/** An example a docs screen shows inline, with its exact source. */
export interface ShowcaseDocsExample {
	readonly id: string;
	readonly label: string;
	readonly anchor: string;
	/** The example's file name in its component's folder (`code-block-17`). */
	readonly file: string;
	readonly source: string;
}

/** The docs screen: Markdown with the two fenced blocks of its own, and every example the body shows, by id. */
export interface ShowcaseDocs {
	readonly body: string;
	readonly examples: readonly ShowcaseDocsExample[];
}

export interface ShowcaseContent {
	readonly overview: ShowcaseOverview;
	readonly docs: ShowcaseDocs;
}
