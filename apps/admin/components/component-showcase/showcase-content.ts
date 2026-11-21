// The shape of a showcase component's written content (components/component-showcase/
// examples/<component>/overview.md and docs.md), compiled by
// `pnpm showcase:generate` into components/component-showcase/generated/content.

/** One question of a component's FAQ, its answer in Markdown. */
export interface ShowcaseFaqEntry {
	readonly question: string;
	readonly answer: string;
}

/** The component page's prose: when to reach for it, an overview, and its FAQ. Every list item is inline Markdown. */
export interface ShowcaseOverview {
	readonly whenToUse: readonly string[];
	readonly whenNotToUse: readonly string[];
	readonly notes: readonly string[];
	/** The overview sections (`##` and `###`), in Markdown. */
	readonly body: string;
	readonly faq: readonly ShowcaseFaqEntry[];
}

/** An example a docs page shows inline, with its exact source. */
export interface ShowcaseDocsExample {
	readonly id: string;
	readonly label: string;
	readonly anchor: string;
	/** The page part the example runs on, or `null` when its component's page is not split. */
	readonly part: string | null;
	readonly file: string;
	readonly source: string;
}

/** The docs page: Markdown with two fenced blocks of its own — `showcase-api` (the API reference) and `showcase-example` (an example by id). */
export interface ShowcaseDocs {
	readonly body: string;
	/** Every example the body shows, by id. */
	readonly examples: readonly ShowcaseDocsExample[];
}

export interface ShowcaseContent {
	readonly overview: ShowcaseOverview;
	readonly docs: ShowcaseDocs;
}

/** The fenced-block language that stands for the generated API reference. */
export const API_FENCE = "showcase-api";
/** The fenced-block language that shows one example (its body is the example's id). */
export const EXAMPLE_FENCE = "showcase-example";
