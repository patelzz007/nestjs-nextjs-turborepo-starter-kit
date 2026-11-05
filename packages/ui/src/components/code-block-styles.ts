// The code block's classes and constants (enhancement 8.1: split from code-block.tsx): root, tokens, lines, pinned controls and timings.

export const ROOT_GHOST_CLASS = "[--code-block-bg:transparent]";

export const ROOT_RADIUS_CLASS = "[--code-block-radius:var(--radius-lg)]";

/*
 * Colour vars use the BASE theme tokens (--card, --primary, ...), never the
 * --color-* twins: those are static @theme literals that ignore a nested
 * `.dark` scope, which once painted a white gutter cell on a forced-dark
 * block. Tints are one system, 8% light / 12% dark (yellow a touch more),
 * matching the *-light badge weights. This item ships the same cssVars.
 */
export const ROOT_TOKEN_CLASS = [
	"[--code-block-padding:--spacing(3)]",
	"[--code-block-gutter-width:--spacing(9)]",
	"[--code-block-gutter-gap:--spacing(2.5)]",
	/* The fold channel sits between the numbers and the code, so both the number
	   cell's padding and the gutter width are expressed against it and a block
	   without folding pays nothing for it. */
	"[--code-block-fold-width:--spacing(4.5)]",
	"[--code-block-number-pad:var(--code-block-gutter-gap)]",
	"data-[gutter-channel]:[--code-block-number-pad:calc(var(--code-block-gutter-gap)+var(--code-block-fold-width))]",
	/* A diff column breathes: the +/- glyph gets a wider channel. */
	"data-[has-diff]:[--code-block-gutter-gap:--spacing(4)]",
	"[--code-block-line-height:1.5rem]",
	"[--code-block-font-size:0.8125rem]",
	"[--code-block-copy-inset:--spacing(2)]",
	/* Where a PINNED control starts. With a header composed in, the root's top
	   edge is the header, so an unadjusted inset drops the copy button onto the
	   title row instead of the code. The header's own `min-h-9` is the height
	   assumed here, plus its 1px bottom border; override the variable for a
	   header built taller than one row. */
	"[--code-block-header-height:--spacing(9)]",
	"[--code-block-copy-top:var(--code-block-copy-inset)]",
	"data-[has-header]:[--code-block-copy-top:calc(var(--code-block-header-height)+1px+var(--code-block-copy-inset))]",
	/* Room the expanded block keeps under the last line for the floating
	   "Show less" control. */
	"[--code-block-expand-clearance:--spacing(9)]",
	/* What sits behind a sticky line number while the code scrolls under it.
	   `ghost` blanks it, because there the surface belongs to the wrapper. */
	"[--code-block-bg:var(--card)]",
	"[--code-block-highlight-bg:color-mix(in_oklch,var(--primary)_6%,transparent)]",
	"dark:[--code-block-highlight-bg:color-mix(in_oklch,var(--primary)_12%,transparent)]",
	"[--code-block-highlight-bar:color-mix(in_oklch,var(--primary)_60%,transparent)]",
	"[--code-block-diff-add-bg:color-mix(in_oklch,var(--success)_8%,transparent)]",
	"dark:[--code-block-diff-add-bg:color-mix(in_oklch,var(--success)_12%,transparent)]",
	"[--code-block-diff-remove-bg:color-mix(in_oklch,var(--destructive)_8%,transparent)]",
	"dark:[--code-block-diff-remove-bg:color-mix(in_oklch,var(--destructive)_12%,transparent)]",
	"[--code-block-error-bg:color-mix(in_oklch,var(--destructive)_8%,transparent)]",
	"dark:[--code-block-error-bg:color-mix(in_oklch,var(--destructive)_12%,transparent)]",
	"[--code-block-warning-bg:color-mix(in_oklch,var(--warning)_10%,transparent)]",
	"dark:[--code-block-warning-bg:color-mix(in_oklch,var(--warning)_14%,transparent)]",
	"[--code-block-info-bg:color-mix(in_oklch,var(--info)_8%,transparent)]",
	"dark:[--code-block-info-bg:color-mix(in_oklch,var(--info)_12%,transparent)]",
	"[--code-block-caret-color:var(--primary)]",
].join(" ");

export const ROOT_BASE_CLASS = "group/code-block relative flex min-w-0 flex-col rounded-(--code-block-radius) text-left";

export const ROOT_SURFACE_CLASS = "border border-border bg-card text-card-foreground bg-clip-padding";

/**
 * The token colour switch: tokens carry only `--cb-c` / `--cb-cd`, and these
 * two rules recolour the whole block per theme instead of a `dark:` utility on
 * every span. The `color:` hint is load-bearing: `text-[var(--x)]` is
 * type-ambiguous to Tailwind and emits NO rule at all, which renders as a
 * highlighter that silently failed. Same reason the font size uses `length:`.
 */
export const TOKEN_COLOR_CLASS =
	"[&_[data-slot=code-block-token]]:text-[color:var(--cb-c,currentColor)] dark:[&_[data-slot=code-block-token]]:text-[color:var(--cb-cd,currentColor)]";

/**
 * A code row's styling: `.code-block-line` in src/styles/components.css (the line base, the line-number
 * gutter, diff glyphs, row states, focus mode and streaming motion). One class, not utilities on each row:
 * every row of every block repeated a ~2,600-character class list, which was 27 MB of the docs build.
 * `data-code-line`, not `data-line`, marks the row: rehype-pretty-code apps ship a global
 * `[data-line] span { color !important }` rule, and reusing its attribute rendered every token monochrome.
 */
export const LINE_CLASS = "code-block-line";

/** Pinned chrome (copy, download) floats over the surface, top-right. */
export const PINNED_CONTROL_CLASS = "absolute top-(--code-block-copy-top) right-(--code-block-copy-inset) z-20";

export const PINNED_HOVER_REVEAL_CLASS = "opacity-0 transition-opacity group-hover/code-block:opacity-100 focus-visible:opacity-100";

/* -------------------------------------------------------------------------- */
/*                                   Timings                                   */
/* -------------------------------------------------------------------------- */

/** How long the copy button shows its "copied" state, by default. */
export const DEFAULT_COPY_FEEDBACK_MS = 2000;
/** How long a failed copy keeps `data-copy-failed`. */
export const COPY_FAILED_FEEDBACK_MS = 2000;
/** Delay before revoking a download's object URL (see the handler). */
export const DOWNLOAD_REVOKE_DELAY_MS = 1000;
/** Distance from the bottom, in px, inside which a stream stays pinned. */
export const STICK_TO_BOTTOM_THRESHOLD_PX = 24;
/** Slack, in px, before an element counts as overflowing (sub-pixel layout). */
export const OVERFLOW_TOLERANCE_PX = 1;
/** Narrowest gutter, in digits, so a stream crossing line 9 does not twitch. */
export const MIN_GUTTER_DIGITS = 2;

/* -------------------------------------------------------------------------- */
/*                                    Folding                                  */
/* -------------------------------------------------------------------------- */
