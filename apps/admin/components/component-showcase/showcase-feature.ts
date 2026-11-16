import type * as React from "react";

/** One feature of a component, as the search and the component page list it (plain data, safe on the server). */
export interface ShowcaseFeatureSummary {
	/** Stable id: the registry example it was ported from (`c-code-block-17`). */
	readonly id: string;
	/** What the feature shows ("Soft Wrap"). */
	readonly label: string;
	/** The feature's anchor on its component's page (`soft-wrap`), unique within the component. */
	readonly anchor: string;
}

/**
 * A feature with its example as a plain component, for tests that render every
 * example of a component synchronously (`components/component-showcase/generated/examples`).
 */
export interface ShowcaseFeatureExample extends ShowcaseFeatureSummary {
	readonly component: React.ComponentType;
}

/** A feature ready to render on its component's page: its live example and that example's exact source. */
export interface ShowcaseFeature extends ShowcaseFeatureSummary {
	/** What the example shows and what it is best for, in a sentence or two. */
	readonly description: string;
	/** The example's file name in its component's folder (`code-block-17`). */
	readonly file: string;
	readonly source: string;
	/** Renders the live example (a render function, so each example keeps its own hooks). */
	readonly render: () => React.JSX.Element;
}

/** One side of a Do / Don't pair: what it says, its live example and that example's exact source. */
export interface ShowcaseGuidelineSide {
	/** The advice, in inline Markdown (`code` spans for prop values). */
	readonly text: string;
	/** The example's file name in its component's folder (`button-do-1`). */
	readonly file: string;
	readonly source: string;
	readonly render: () => React.JSX.Element;
}

/** A Do / Don't pair: the right way and the wrong way to use a component, both live. */
export interface ShowcaseGuideline {
	readonly title: string;
	readonly do: ShowcaseGuidelineSide;
	readonly dont: ShowcaseGuidelineSide;
}

/** One side of a pair as a plain component, for tests that render every one. */
export interface ShowcaseGuidelineExample {
	readonly file: string;
	readonly component: React.ComponentType;
}
