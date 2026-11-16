// ============================================
// lib/ui/diagram/diagram-theme.ts — Pele's variables on the kit's tokens
// ============================================
// Pele (https://pele.run) draws a diagram as SVG whose colours, radius and fonts
// are CSS variables (`--pele-*`, pele.run/theming). Their map onto the design
// tokens lives in @workspace/tokens (shared with the native Diagram): here the
// `Diagram` component sets them as `var(--token)` references (so light / dark /
// Nord switch without a re-render), and the README diagram generator resolves the
// same tokens to literal colours per theme.

import { DIAGRAM_COLOR_TOKENS } from "@workspace/tokens";

export { DIAGRAM_COLOR_TOKENS, type DiagramColorVariable } from "@workspace/tokens";

/** Corner radius of rounded shapes: the kit's medium radius. */
export const DIAGRAM_RADIUS = "var(--radius-md)";

/** Label fonts — the app's sans and mono stacks, so measured labels fit. */
export const DIAGRAM_FONT = "var(--font-sans)";
export const DIAGRAM_FONT_MONO = "var(--font-mono, ui-monospace, monospace)";

/** The variables as `var(--token)` references, for a diagram's container `style`. */
export function diagramThemeStyle(): Readonly<Record<string, string>> {
	const colors = Object.entries(DIAGRAM_COLOR_TOKENS).map(([variable, token]): [string, string] => [variable, `var(--${token})`]);
	return Object.fromEntries([...colors, ["--pele-radius", DIAGRAM_RADIUS], ["--pele-font", DIAGRAM_FONT], ["--pele-font-mono", DIAGRAM_FONT_MONO]]);
}
