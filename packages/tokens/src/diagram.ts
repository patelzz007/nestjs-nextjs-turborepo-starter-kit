// Pele's colour variables on the design tokens: the one map the web Diagram (CSS `var(--token)` references), its
// README generator (literal colours per theme) and the native Diagram (colours read from the stylesheet) all use.
// Pele (https://pele.run) draws Mermaid diagrams as SVG whose colours are `--pele-*` variables (pele.run/theming).

import type { ColorTokenName } from "./schema";

/** A Pele colour variable, e.g. `--pele-line`. */
export type DiagramColorVariable = `--pele-${string}`;

/**
 * The Pele colour variables the theme decides, and the semantic token that fills each. Pele's
 * `--pele-fg-on-light` / `--pele-fg-on-dark` (text on a fill the diagram source sets) are left at
 * their defaults: near-black and white are right on such fills in every theme.
 */
export const DIAGRAM_COLOR_TOKENS: Readonly<Record<DiagramColorVariable, ColorTokenName>> = {
	"--pele-bg": "card",
	"--pele-fg": "foreground",
	"--pele-muted": "muted-foreground",
	"--pele-line": "muted-foreground",
	"--pele-surface": "secondary",
	"--pele-surface-alt": "muted",
	"--pele-border": "border",
	"--pele-accent": "primary",
	"--pele-critical": "destructive",
	"--pele-error": "destructive",
	"--pele-series-1": "chart-1",
	"--pele-series-2": "chart-2",
	"--pele-series-3": "chart-3",
	"--pele-series-4": "chart-4",
	"--pele-series-5": "chart-5",
	"--pele-series-6": "info",
	"--pele-series-7": "success",
	"--pele-series-8": "warning",
};
