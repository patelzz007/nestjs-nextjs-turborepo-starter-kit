import type { FlowchartModel, Mounted, RenderResult } from "pele/lazy";

/**
 * Renders the guides' diagrams (```mermaid fences, emitted by `remarkDiagrams`
 * as `<figure class="diagram"><pre class="diagram-source">`) with Pele, a
 * Mermaid-syntax renderer that outputs plain, CSS-themed SVG:
 *
 * - The renderer, and only the diagram types a page uses, are downloaded on
 *   pages that contain a diagram (`pele/lazy`), never on first load.
 * - Labels are measured in the page's own font (Pele reads it from the canvas
 *   and redraws once web fonts load), so no label is ever clipped, and the
 *   layout adapts to the column width instead of shrinking the drawing.
 * - Colours are CSS variables (global.css → "Diagrams"), so a theme switch
 *   recolours a diagram without re-rendering it.
 * - Flowchart nodes get a `data-role` from their shape and their place in the
 *   graph (an entry point, a store, a decision, an outcome …), and sequence
 *   participants a `data-hue`, which global.css turns into colour. A node the
 *   author styled (`classDef` / `style`) keeps the author's colours.
 *
 * While a diagram renders its figure is `aria-busy` (a skeleton in CSS). The
 * source stays in the page for screen readers and no-script readers, and stays
 * visible if rendering fails (`data-error`).
 */

/** What a flowchart node is for, as global.css colours it. */
export type DiagramRole = "entry" | "step" | "store" | "decision" | "outcome" | "person";

/**
 * Pele only re-orients a too-wide flowchart when its container is narrower
 * than `directionBreakpoint` (640 px by default, a phone). The reading column is
 * wider than that, so wide diagrams were scaled down instead; with no
 * breakpoint, any diagram that does not fit is re-oriented when that helps.
 */
const ADAPT_DIRECTION_AT_ANY_WIDTH = Number.POSITIVE_INFINITY;

/** The participant hues global.css defines (`[data-hue="1"]` … `[data-hue="6"]`), reused in order. */
export const PARTICIPANT_HUE_COUNT = 6;

const SHAPE_ROLES: Readonly<Record<string, DiagramRole>> = {
	"pele-shape-cyl": "store",
	"pele-shape-diam": "decision",
	"pele-shape-circle": "person",
	"pele-shape-dblcircle": "person",
};

/**
 * The role of every flowchart node, from its shape and its edges: a cylinder is
 * a store, a diamond a decision, a circle a person; otherwise a node nothing
 * points to is an entry point, one that points to nothing an outcome, and the
 * rest are steps. Nodes the author styled are left out.
 */
export function flowchartRoles(model: FlowchartModel, shapeOf: (id: string) => string | undefined): Map<string, DiagramRole> {
	const incoming = new Set(model.edges.map((edge) => edge.end));
	const outgoing = new Set(model.edges.map((edge) => edge.start));
	const roles = new Map<string, DiagramRole>();
	for (const node of model.nodes.values()) {
		if (node.classes.length > 0 || node.styles.length > 0) {
			continue;
		}
		const shapeRole = SHAPE_ROLES[shapeOf(node.id) ?? ""];
		if (shapeRole !== undefined) {
			roles.set(node.id, shapeRole);
		} else if (!incoming.has(node.id) && outgoing.has(node.id)) {
			roles.set(node.id, "entry");
		} else if (incoming.has(node.id) && !outgoing.has(node.id)) {
			roles.set(node.id, "outcome");
		} else {
			roles.set(node.id, "step");
		}
	}
	return roles;
}

/** The `pele-shape-*` class of a rendered node. */
function shapeClass(node: Element): string | undefined {
	return [...node.classList].find((name) => name.startsWith("pele-shape-"));
}

function nodesById(canvas: HTMLElement, selector: string): Map<string, Element[]> {
	const byId = new Map<string, Element[]>();
	for (const node of canvas.querySelectorAll(selector)) {
		const id = node.getAttribute("data-id");
		if (id !== null) {
			byId.set(id, [...(byId.get(id) ?? []), node]);
		}
	}
	return byId;
}

/** Tags the freshly drawn SVG with roles and hues (Pele redraws on resize, so this runs after every render). */
function decorate(canvas: HTMLElement, result: RenderResult, flowchart: FlowchartModel | undefined): void {
	if (result.type === "flowchart" && flowchart !== undefined) {
		const nodes = nodesById(canvas, ".pele-node");
		const roles = flowchartRoles(flowchart, (id) => {
			const [first] = nodes.get(id) ?? [];
			return first === undefined ? undefined : shapeClass(first);
		});
		for (const [id, role] of roles) {
			for (const node of nodes.get(id) ?? []) {
				node.setAttribute("data-role", role);
			}
		}
		return;
	}
	if (result.type === "sequence") {
		const actors = nodesById(canvas, ".pele-actor, .pele-lifeline");
		[...actors.keys()].forEach((id, index) => {
			const hue = String((index % PARTICIPANT_HUE_COUNT) + 1);
			for (const element of actors.get(id) ?? []) {
				element.setAttribute("data-hue", hue);
			}
		});
	}
}

/**
 * Renders one figure; resolves once it is drawn or has failed. The diagram
 * type is loaded and the source parsed first (a syntax error lands in `catch`),
 * then the diagram is mounted into a canvas that is already in the page, so the
 * first render is laid out for the real column width.
 */
async function renderFigure(figure: HTMLElement, source: string): Promise<Mounted | undefined> {
	const { detectType, load, mount, parse } = await import("pele/lazy");
	const canvas = document.createElement("div");
	canvas.className = "diagram-canvas";
	try {
		await load(detectType(source));
		const model = parse(source);
		const flowchart = model.type === "flowchart" ? model : undefined;
		figure.append(canvas);
		const mounted = mount(canvas, source, {
			// A flowchart too wide for the column is laid out the other way round (when that is narrower) instead
			// of being shrunk until its labels are unreadable — at any column width, not just phone widths.
			autoDirection: true,
			directionBreakpoint: ADAPT_DIRECTION_AT_ANY_WIDTH,
			zoom: "auto",
			onRender: (result: RenderResult): void => {
				decorate(canvas, result, flowchart);
			},
		});
		if (mounted.result === undefined) {
			canvas.remove();
			figure.dataset.error = "true";
			return undefined;
		}
		figure.dataset.rendered = "true";
		return mounted;
	} catch {
		canvas.remove();
		figure.dataset.error = "true";
		return undefined;
	} finally {
		figure.removeAttribute("aria-busy");
	}
}

export function initDiagrams(): void {
	const figures = [...document.querySelectorAll<HTMLElement>("figure.diagram")];
	for (const figure of figures) {
		const source = figure.querySelector("pre.diagram-source")?.textContent ?? "";
		figure.setAttribute("aria-busy", "true");
		void renderFigure(figure, source);
	}
}
