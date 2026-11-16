import { render, type RenderOptions } from "pele";

import { DIAGRAM_CANVAS_WIDTH_PX, DIAGRAM_LAYOUT_OPTIONS } from "./diagram-layout";

/**
 * Whether a flowchart is written the way the site shows it. The site turns a flowchart too wide for its column the
 * other way round (`diagram-layout.ts`); other tools draw what the file says, and Notion has no such rule, so it
 * shrinks the chart instead. A chart the site turns round must be written the way the site shows it, or the two
 * disagree (ADR 084). Run against every docs page by its test.
 */

/** Every way a flowchart can be written to run; `TB` is the same as `TD`. */
const DIRECTION_PATTERN = /^(?<keyword>flowchart|graph)[ \t]+(?<direction>TB|TD|BT|RL|LR)\b/u;
const MERMAID_FENCE_PATTERN = /^```mermaid[ \t]*\n(?<source>[\s\S]*?)^```/gmu;
const DIRECTIONS_TO_SUGGEST: readonly string[] = ["TD", "LR"];
const ANOTHER_LAYOUT = "another layout";

/** A flowchart the site shows the other way round from how it is written. */
export interface DirectionMismatch {
	readonly written: string;
	/** `TD` or `LR` when the site's layout is that direction; `another layout` when it is neither. */
	readonly shown: string;
}

/** The same chart, written to run `direction`. */
function runningAs(source: string, direction: string): string {
	return source.replace(DIRECTION_PATTERN, (_match, keyword: string) => `${keyword} ${direction}`);
}

/** The chart laid out at the desktop column width: as the site does with `options`, exactly as written without. */
function layout(source: string, options: RenderOptions = {}): string {
	return render(source, { maxWidth: DIAGRAM_CANVAS_WIDTH_PX, idPrefix: "check", ...options }).svg;
}

/**
 * How the site shows a flowchart, when that is not how it is written; null when they agree, or when the source is not
 * a flowchart with a direction. Text is measured with pele's built-in font metrics, which follow the site's fonts
 * closely enough for this: the decision is about a whole chart being too wide, not about a pixel.
 */
export function directionMismatch(source: string): DirectionMismatch | null {
	const chart = source.trimStart();
	const written = DIRECTION_PATTERN.exec(chart)?.groups?.direction;
	if (written === undefined) {
		return null;
	}
	const shown = layout(chart, DIAGRAM_LAYOUT_OPTIONS);
	if (shown === layout(chart)) {
		return null;
	}
	return { written, shown: DIRECTIONS_TO_SUGGEST.find((direction) => shown === layout(runningAs(chart, direction))) ?? ANOTHER_LAYOUT };
}

/** The mermaid sources of a Markdown page, in order. */
export function mermaidSources(markdown: string): readonly string[] {
	return [...markdown.matchAll(MERMAID_FENCE_PATTERN)].flatMap((match) => {
		const source = match.groups?.source;
		return source === undefined ? [] : [source];
	});
}
