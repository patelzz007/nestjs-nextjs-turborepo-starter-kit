// The shape of a showcase component's written content (features/showcase/
// examples/<component>/overview.md and docs.md), compiled by the showcase
// generator into features/showcase/generated/content.

import type { ShowcaseSource } from "./showcase-feature";

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
export interface ShowcaseDocsExample extends ShowcaseSource {
	readonly id: string;
	readonly label: string;
	readonly anchor: string;
}

/** The docs screen: Markdown with two fenced blocks of its own — `showcase-api` (the API reference) and `showcase-example` (an example by id). */
export interface ShowcaseDocs {
	readonly body: string;
	/** Every example the body shows, by id. */
	readonly examples: readonly ShowcaseDocsExample[];
}

export interface ShowcaseContent {
	readonly overview: ShowcaseOverview;
	readonly docs: ShowcaseDocs;
}

export { API_FENCE, EXAMPLE_FENCE } from "./showcase-fences";
