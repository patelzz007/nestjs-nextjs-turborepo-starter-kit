import { flowchartRoles, type DiagramRole } from "@workspace/docs-content/diagram-roles";
import type { FlowchartModel, Mounted, RenderResult } from "pele/lazy";

import { DIAGRAM_LAYOUT_OPTIONS } from "@/lib/diagram-layout";

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

/** The participant hues global.css defines (`[data-hue="1"]` … `[data-hue="6"]`), reused in order. */
export const PARTICIPANT_HUE_COUNT = 6;

/** The roles the drawn shapes mean (Pele's `pele-shape-*` classes; a double circle is `pele-shape-dbl`). */
export const SHAPE_ROLES: Readonly<Record<string, DiagramRole>> = {
	"pele-shape-cyl": "store",
	"pele-shape-diam": "decision",
	"pele-shape-circle": "person",
	"pele-shape-dbl": "person",
};

/** The role of every flowchart node (`flowchartRoles`, shared with Notion), with each shape read from the drawing. */
export function drawnFlowchartRoles(model: FlowchartModel, shapeOf: (id: string) => string | undefined): Map<string, DiagramRole> {
	return flowchartRoles({ nodes: model.nodes.values(), edges: model.edges }, (id) => SHAPE_ROLES[shapeOf(id) ?? ""]);
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
		const roles = drawnFlowchartRoles(flowchart, (id) => {
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
			// of being shrunk until its labels are unreadable, at any column width. The docs check holds the
			// written direction to this (src/lib/diagram-layout.ts).
			...DIAGRAM_LAYOUT_OPTIONS,
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

/**
 * Draws every diagram inside `root` (the article). Returns a cleanup that destroys the mounted diagrams —
 * Pele keeps a resize observer per diagram — for when the page's content is replaced (client navigation).
 */
export function initDiagrams(root: ParentNode = document): () => void {
	const pending = [...root.querySelectorAll<HTMLElement>("figure.diagram")].map((figure): Promise<Mounted | undefined> => {
		const source = figure.querySelector("pre.diagram-source")?.textContent ?? "";
		figure.setAttribute("aria-busy", "true");
		return renderFigure(figure, source);
	});
	return (): void => {
		for (const mounted of pending) {
			void mounted.then((diagram) => {
				diagram?.destroy();
			});
		}
	};
}
