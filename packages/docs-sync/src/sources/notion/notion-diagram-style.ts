import { DIAGRAM_ROLES, flowchartRoles, type DiagramRole } from "@workspace/docs-content/diagram-roles";
import { parse, type ParsedDiagramModel } from "pele";

/**
 * Colour for flowcharts in Notion. The docs site colours each node by what it is for (`diagram-roles.ts`), in the
 * reader's theme; Notion draws plain Mermaid, all grey. So a flowchart going into Notion gets a style block with
 * the same colours by the same rules, and the sync takes the block out again on the way back: the repository's
 * Markdown never holds it, and the site keeps its theme-aware colours (a node with author styles would keep those
 * instead, `apps/docs/src/browser/diagrams.ts`).
 *
 * The colours are fixed, so they must read on Notion's light and dark pages alike: a light tint of each role's hue
 * (the site's `--diagram-*` colours) as the fill, the hue itself as the outline, and a dark shade of it for the text.
 *
 * Notion measures a label in one font and draws it in another, and Mermaid's HTML labels do not wrap, so long
 * labels were cut off. The block asks for SVG text labels, which never clip, and pins one font for measuring and
 * drawing, twice over: in the `init` directive, and on every coloured node, in case a Mermaid ignores directives.
 * Edge labels become solid rounded pills with room around the text (Mermaid draws them half see-through, a grey
 * square on a dark page, and only as wide as the text), and a yes or no edge is drawn green or red.
 */

export const STYLE_START = "%% docs-sync:style-start";
export const STYLE_END = "%% docs-sync:style-end";
const STYLE_NOTE = "%% Colours for Notion; the docs sync removes this block. To colour a node you add, put its id on a class line.";

interface RoleColours {
	readonly fill: string;
	readonly stroke: string;
	readonly text: string;
	readonly strokeWidth: string;
}

const ROLE_COLOURS: Readonly<Record<DiagramRole, RoleColours>> = {
	entry: { fill: "#d1e9ff", stroke: "#2e90fa", text: "#194185", strokeWidth: "2px" },
	// The most common role: a quieter outline, so the others stand out.
	step: { fill: "#e4e9f2", stroke: "#516480", text: "#1d2939", strokeWidth: "1.5px" },
	store: { fill: "#ccfbef", stroke: "#15b79e", text: "#134e48", strokeWidth: "2px" },
	decision: { fill: "#fef0c7", stroke: "#f79009", text: "#7a2e0e", strokeWidth: "2px" },
	outcome: { fill: "#ebe9fe", stroke: "#7a5af8", text: "#3e1c96", strokeWidth: "2px" },
	person: { fill: "#ffe4e8", stroke: "#f63d68", text: "#89123e", strokeWidth: "2px" },
};

/** The site's 8px diagram corners (`--pele-radius`). Ignored by shapes without corners. */
const CORNER_RADIUS = "8px";
/** One font for measuring and drawing: a generic family resolves to the same face both times. */
const FONT_FAMILY = "sans-serif";
/** The site's `--diagram-line`. */
const EDGE_STYLE = "stroke:#7d8797,stroke-width:1.5px";

/** The first words of an answer edge's label, by answer: `yes, shows reward` is a yes. */
const ANSWER_WORDS = {
	yes: new Set(["yes", "ok", "pass", "passed", "approve", "approved", "allowed", "success", "valid"]),
	no: new Set(["no", "fail", "failed", "reject", "rejected", "denied", "invalid", "error"]),
} satisfies Readonly<Record<string, ReadonlySet<string>>>;
/** An answer edge's answer: the keys of `ANSWER_WORDS`, so the words table is the one source. */
type Answer = keyof typeof ANSWER_WORDS;
/** The site's success and error hues. The label stays neutral: coloured text is unreadable on a grey label. */
const ANSWER_EDGE_STYLES: Readonly<Record<Answer, string>> = {
	yes: "stroke:#17b26a,stroke-width:2px",
	no: "stroke:#f04438,stroke-width:2px",
};
const FIRST_WORD = /^\W*(?<word>[a-z]+)/u;

const EDGE_LABEL_FILL = "#f2f4f7";
/**
 * Space added on each side of an edge label's pill. Mermaid sizes the pill to the text alone, so a short label like
 * `no` sat in a pill barely wider than the word.
 */
const EDGE_LABEL_SIDE_PADDING = "10px";
/** Space added above and below an edge label's text, which Mermaid's pill otherwise touches. */
const EDGE_LABEL_END_PADDING = "3px";
/**
 * Mermaid lays the chart out for the pills it drew, so the wider pills need room: side-by-side labels touched at
 * Mermaid's default space between nodes (50). Twice the side padding more keeps them apart.
 */
const NODE_SPACING = 70;
/**
 * Edge labels as solid rounded pills with dark text, in both of Mermaid's label kinds (SVG text and HTML).
 *
 * Mermaid writes SVG label text from its left edge, in a pill it sized for that text in its own font size and
 * weight. So the CSS must not change either: smaller or bolder text no longer fills the pill and sits off to the
 * left. To widen the pill, two shadow copies of it in its own colour, shifted left and right, extend it equally on
 * both sides, so the text stays centred; a last soft shadow outlines the whole shape. A stroke would outline only
 * the middle copy.
 */
const EDGE_LABEL_CSS = [
	`.edgeLabel rect{opacity:1 !important;fill:${EDGE_LABEL_FILL} !important;stroke:none !important;rx:9px;ry:9px;filter:drop-shadow(${EDGE_LABEL_SIDE_PADDING} 0 0 ${EDGE_LABEL_FILL}) drop-shadow(-${EDGE_LABEL_SIDE_PADDING} 0 0 ${EDGE_LABEL_FILL}) drop-shadow(0 ${EDGE_LABEL_END_PADDING} 0 ${EDGE_LABEL_FILL}) drop-shadow(0 -${EDGE_LABEL_END_PADDING} 0 ${EDGE_LABEL_FILL}) drop-shadow(0 0 1px #667085)}`,
	`.edgeLabel .labelBkg,.edgeLabel span,.edgeLabel p{background-color:${EDGE_LABEL_FILL} !important;opacity:1 !important;border-radius:9px;color:#344054 !important}`,
	".edgeLabel text,.edgeLabel tspan{fill:#344054 !important}",
].join(" ");

/** Mermaid reads the directive wherever it is, so it can sit in the block. `htmlLabels` moved in Mermaid 11: both. */
const INIT_DIRECTIVE = `%%{init: ${JSON.stringify({
	htmlLabels: false,
	flowchart: { htmlLabels: false, nodeSpacing: NODE_SPACING },
	themeVariables: { fontFamily: FONT_FAMILY, edgeLabelBackground: EDGE_LABEL_FILL },
	themeCSS: EDGE_LABEL_CSS,
})}}%%`;

/** Shape names, as Mermaid's two syntaxes spell them (`A[(db)]` is `cylinder`; `A@{ shape: cyl }` is `cyl`), that carry a role. */
const SHAPE_ROLES: Readonly<Record<string, DiagramRole>> = {
	cylinder: "store",
	cyl: "store",
	db: "store",
	database: "store",
	diamond: "decision",
	diam: "decision",
	decision: "decision",
	question: "decision",
	circle: "person",
	circ: "person",
	doublecircle: "person",
	"dbl-circ": "person",
	"double-circle": "person",
};

/** `A & B --> C` is one statement and several edges; Mermaid's `linkStyle` numbering of those is not worth guessing. */
const EDGE_GROUP = /\s&\s/u;

function classDefOf(role: DiagramRole): string {
	const colours = ROLE_COLOURS[role];
	return `classDef ${role} fill:${colours.fill},stroke:${colours.stroke},stroke-width:${colours.strokeWidth},color:${colours.text},rx:${CORNER_RADIUS},ry:${CORNER_RADIUS},font-family:${FONT_FAMILY}`;
}

function answerOf(label: string): Answer | null {
	const word = FIRST_WORD.exec(label.toLowerCase())?.groups?.word ?? "";
	if (ANSWER_WORDS.yes.has(word)) {
		return "yes";
	}
	return ANSWER_WORDS.no.has(word) ? "no" : null;
}

/** `linkStyle <index> …` for every yes or no edge the author has not styled, by its place in the chart. */
function answerEdgeStyles(source: string, edges: readonly { readonly text: string; readonly style?: readonly string[] }[]): readonly string[] {
	if (EDGE_GROUP.test(source)) {
		return [];
	}
	return edges.flatMap((edge, index): string[] => {
		const answer = answerOf(edge.text);
		return answer === null || (edge.style?.length ?? 0) > 0 ? [] : [`linkStyle ${String(index)} ${ANSWER_EDGE_STYLES[answer]}`];
	});
}

/** The source without the Notion style block; unchanged when it has none, or only half of one. */
export function withoutNotionStyle(source: string): string {
	const lines = source.split("\n");
	const start = lines.findIndex((line) => line.trim() === STYLE_START);
	const end = lines.findIndex((line, index) => index > start && line.trim() === STYLE_END);
	if (start === -1 || end === -1) {
		return source;
	}
	return [...lines.slice(0, start), ...lines.slice(end + 1)].join("\n");
}

/**
 * The flowchart with a Notion style block after it, colouring each node by its role. Anything else (another
 * diagram type, a chart that does not parse, one whose every node the author styled) is returned unchanged. Safe
 * to run again: an existing block is replaced.
 */
export function withNotionStyle(source: string): string {
	const bare = withoutNotionStyle(source);
	let model: ParsedDiagramModel;
	try {
		model = parse(bare);
	} catch {
		return bare;
	}
	if (model.type !== "flowchart") {
		return bare;
	}
	const nodes = model.nodes;
	const roles = flowchartRoles({ nodes: nodes.values(), edges: model.edges }, (id) => SHAPE_ROLES[nodes.get(id)?.type ?? ""]);
	if (roles.size === 0) {
		return bare;
	}
	const idsByRole = DIAGRAM_ROLES.map((role) => ({ role, ids: [...roles].filter(([, nodeRole]) => nodeRole === role).map(([id]) => id) })).filter(({ ids }) => ids.length > 0);
	const edges = model.edges.length > 0 && model.defaultEdgeStyle === undefined ? [`linkStyle default ${EDGE_STYLE}`] : [];
	const block = [
		STYLE_START,
		STYLE_NOTE,
		INIT_DIRECTIVE,
		...idsByRole.map(({ role }) => classDefOf(role)),
		...idsByRole.map(({ role, ids }) => `class ${ids.join(",")} ${role}`),
		...edges,
		...answerEdgeStyles(bare, model.edges),
		STYLE_END,
	];
	return [bare, ...block].join("\n");
}
