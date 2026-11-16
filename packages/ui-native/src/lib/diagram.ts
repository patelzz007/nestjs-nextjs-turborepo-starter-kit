// The native Diagram's rules: which theme colours it reads (Pele's `--pele-*` variables on the design tokens, the map
// the web shares in @workspace/tokens), and turning Pele's SVG into one react-native-svg can draw. Pele themes its SVG
// with CSS custom properties (`fill="var(--_fg)"`, defined on the root `<svg style>`); react-native-svg has no CSS
// variables, so every `var()` is resolved to its literal value here. Also the diagram's accessible name and summary
// (Mermaid's `accTitle:` and `accDescr:`, which Pele writes as `<title>` and `<desc>`).

import { DIAGRAM_COLOR_TOKENS } from "@workspace/tokens";

export interface DiagramLabels {
	/** Announced while the theme's colours load. */
	readonly loading: string;
	/** Shown, with Pele's reason, when the source cannot be drawn. */
	readonly error: string;
}

export const DEFAULT_DIAGRAM_LABELS: DiagramLabels = { loading: "Loading diagram…", error: "This diagram could not be drawn." };

/** Each Pele colour variable and the stylesheet variable of its token (`--pele-bg` → `--color-card`). */
export const DIAGRAM_THEME_VARIABLES: readonly (readonly [string, string])[] = Object.entries(DIAGRAM_COLOR_TOKENS).map(([variable, token]): readonly [string, string] => [
	variable,
	`--color-${token}`,
]);

/** Rounded shapes' corner radius, in points (the web's medium radius). */
export const DIAGRAM_RADIUS = "6";

/** One `var(--name)` or `var(--name, fallback)`, the fallback holding at most one level of parentheses. */
const VAR_PATTERN = /var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/gu;
/** The root `<svg …>` tag's `style="…"` attribute. */
const ROOT_STYLE_PATTERN = /(<svg\b[^>]*?)\sstyle="([^"]*)"/u;
/** How deep `var()` references may nest before resolving stops (Pele uses two levels). */
const MAX_DEPTH = 8;

/** The custom properties (`--name: value`) a style attribute declares. */
function customProperties(style: string): ReadonlyMap<string, string> {
	const entries = style
		.split(";")
		.map((declaration: string): readonly [string, string] | null => {
			const colon = declaration.indexOf(":");
			const name = declaration.slice(0, colon).trim();
			return colon > 0 && name.startsWith("--") ? [name, declaration.slice(colon + 1).trim()] : null;
		})
		.filter((entry): entry is readonly [string, string] => entry !== null);
	return new Map(entries);
}

/** `text` with every `var()` replaced: the theme's value, else the root's own property, else the fallback, else nothing. */
function resolveValue(text: string, theme: Readonly<Record<string, string>>, root: ReadonlyMap<string, string>, depth: number): string {
	if (depth > MAX_DEPTH) {
		return "";
	}
	return text.replace(VAR_PATTERN, (_match: string, name: string, fallback: string | undefined): string => {
		const value = theme[name] ?? root.get(name) ?? fallback ?? "";
		return resolveValue(value.trim(), theme, root, depth + 1);
	});
}

/**
 * Pele's SVG with every CSS variable resolved: `theme` gives the `--pele-*` values (the theme's colours), the root
 * `<svg style>` gives Pele's own (`--_fg: var(--pele-fg, #1f1f1f)`), and a fallback covers the rest. The root style is
 * then dropped: react-native-svg reads attributes, not CSS.
 */
export function resolveDiagramSvg(svg: string, theme: Readonly<Record<string, string>>): string {
	const match = ROOT_STYLE_PATTERN.exec(svg);
	const [, , style = ""] = match ?? [];
	const root = customProperties(style);
	const withoutStyle = match === null ? svg : svg.replace(ROOT_STYLE_PATTERN, "$1");
	return resolveValue(withoutStyle, theme, root, 0);
}

const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

function decodeEntities(text: string): string {
	return text.replace(/&(?:amp|lt|gt|quot|apos|#39);/gu, (entity: string): string => ENTITIES[entity] ?? entity);
}

/** The diagram's accessible name and summary (its `<title>` and `<desc>`), empty when the source gave none. */
export function diagramSummary(svg: string): { readonly title: string; readonly description: string } {
	const [, title = ""] = /<title[^>]*>([\s\S]*?)<\/title>/u.exec(svg) ?? [];
	const [, description = ""] = /<desc[^>]*>([\s\S]*?)<\/desc>/u.exec(svg) ?? [];
	return { title: decodeEntities(title.trim()), description: decodeEntities(description.trim()) };
}
