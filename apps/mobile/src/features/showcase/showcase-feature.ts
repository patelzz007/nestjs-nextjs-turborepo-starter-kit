import type * as React from "react";

/** One feature of a component, as the search and the component screen list it (plain data). */
export interface ShowcaseFeatureSummary {
	/** Stable id: the web example it mirrors (`c-code-block-17`). */
	readonly id: string;
	/** What the feature shows ("Soft Wrap"). */
	readonly label: string;
	/** The feature's anchor on its component's screen (`soft-wrap`), unique within the component. */
	readonly anchor: string;
}

/** A feature with its example as a plain component, for tests that render every example of a component. */
export interface ShowcaseFeatureExample extends ShowcaseFeatureSummary {
	readonly component: React.ComponentType;
}

/** An example's exact source, as the code view shows it (its colouring loads with the code view: generated/code). */
export interface ShowcaseSource {
	/** The example's file name in its component's folder (`code-block-17`). */
	readonly file: string;
	readonly source: string;
}

/** A feature ready to render on its component's screen: its live example and that example's exact source. */
export interface ShowcaseFeature extends ShowcaseFeatureSummary, ShowcaseSource {
	/** What the example shows and what it is best for, in a sentence or two. */
	readonly description: string;
	/** Renders the live example (a render function, so each example keeps its own hooks). */
	readonly render: () => React.JSX.Element;
}

/** One side of a guideline: what to do (or not), and a live example of it. */
export interface ShowcaseGuidelineSide extends ShowcaseSource {
	readonly text: string;
	readonly render: () => React.JSX.Element;
}

/** A Do / Don't pair: the right way and the wrong way to use the component, side by side. */
export interface ShowcaseGuideline {
	readonly title: string;
	readonly do: ShowcaseGuidelineSide;
	readonly dont: ShowcaseGuidelineSide;
}

/** Everything a component's generated module holds: its features and its Do / Don't pairs. */
export interface ShowcaseComponentModule {
	readonly features: readonly ShowcaseFeature[];
	readonly guidelines: readonly ShowcaseGuideline[];
}
