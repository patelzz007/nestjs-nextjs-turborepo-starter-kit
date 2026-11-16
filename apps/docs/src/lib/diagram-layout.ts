import type { RenderOptions } from "pele/lazy";

/**
 * How the site lays out a diagram: `src/browser/diagrams.ts` mounts with these, and `diagram-direction.ts` checks the
 * docs against them. Type-only import, so the page still loads pele lazily.
 *
 * pele only re-orients a too-wide flowchart when its container is narrower than `directionBreakpoint` (640 px by
 * default, a phone). The reading column is wider than that, so wide diagrams were scaled down instead; with no
 * breakpoint, any flowchart that does not fit is laid out the other way round when that is narrower, instead of
 * being shrunk until its labels are unreadable.
 */
export const DIAGRAM_LAYOUT_OPTIONS = {
	autoDirection: true,
	directionBreakpoint: Number.POSITIVE_INFINITY,
} satisfies RenderOptions;

const PX_PER_REM = 16;
/** `--type-measure` in styles/app.css: the reading column at its widest. */
const READING_COLUMN_REM = 48;
/** `.diagram`'s horizontal padding (1.25rem a side) and border (1px a side) in styles/app.css. */
const DIAGRAM_INSET_PX = 2 * 1.25 * PX_PER_REM + 2;
/** The width a diagram is laid out in on a desktop screen. A chart turned round here is turned round on every narrower one too. */
export const DIAGRAM_CANVAS_WIDTH_PX = READING_COLUMN_REM * PX_PER_REM - DIAGRAM_INSET_PX;
