// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MountOptions, Mounted, RenderResult } from "pele/lazy";

/*
 * Pele's real parser and renderer run here; only `mount` is replaced, because
 * jsdom has no layout engine, canvas or ResizeObserver for Pele's measuring and
 * zoom. The stand-in draws Pele's real SVG into the element and fires
 * `onRender`, exactly as `mount` does after each render.
 */
const mountCalls = vi.hoisted((): { count: number } => ({ count: 0 }));

vi.mock("pele/lazy", async (importOriginal) => {
	const actual = await importOriginal<typeof import("pele/lazy")>();
	return {
		...actual,
		mount: (element: HTMLElement, text: string, options?: MountOptions): Mounted => {
			mountCalls.count += 1;
			const result: RenderResult = actual.render(text, { ...options, responsive: false });
			element.innerHTML = result.svg;
			options?.onRender?.(result);
			return { result, source: text, error: undefined, zoom: undefined, update: vi.fn(), refresh: vi.fn(), destroy: vi.fn() };
		},
	};
});

const { flowchartRoles, initDiagrams } = await import("../diagrams");
const { load, parse } = await import("pele/lazy");
// `pele/lazy` registers a diagram type on first use; the unit test below parses before any render.
await load("flowchart");

function figure(source: string): string {
	return `<figure class="diagram"><pre class="diagram-source">${source.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre></figure>`;
}

async function rendered(): Promise<HTMLElement> {
	const element = document.querySelector<HTMLElement>("figure.diagram");
	if (element === null) {
		throw new Error("expected a figure");
	}
	await vi.waitFor(() => {
		expect(element.hasAttribute("aria-busy")).toBe(false);
	});
	return element;
}

function roleOf(root: HTMLElement, id: string): string | null {
	return root.querySelector(`.pele-node[data-id="${id}"]`)?.getAttribute("data-role") ?? null;
}

const FLOWCHART = `flowchart LR
  Start[Request] --> Check{Allowed?}
  Check --> Store[(sessions)]
  Store --> Done[Response]
  Check --> Person((User))
  Person --> Done
  Styled[Custom] --> Done
  classDef hot fill:#f00
  Styled:::hot`;

describe("flowchartRoles", () => {
	it("derives each node's role from its shape and edges, and skips nodes the author styled", () => {
		const model = parse(FLOWCHART);
		if (model.type !== "flowchart") {
			throw new Error("expected a flowchart model");
		}
		const shapes: Readonly<Record<string, string>> = { Check: "pele-shape-diam", Store: "pele-shape-cyl", Person: "pele-shape-circle" };
		const roles = flowchartRoles(model, (id) => shapes[id] ?? "pele-shape-rect");
		expect(Object.fromEntries(roles)).toEqual({ Start: "entry", Check: "decision", Store: "store", Done: "outcome", Person: "person" });
	});
});

describe("initDiagrams", () => {
	beforeEach(() => {
		mountCalls.count = 0;
		document.body.innerHTML = "";
	});

	it("does nothing on a page without diagrams", async () => {
		initDiagrams();
		await Promise.resolve();
		expect(mountCalls.count).toBe(0);
	});

	it("draws a flowchart with a role on every node, keeping the source for assistive tech", async () => {
		document.body.innerHTML = figure(FLOWCHART);
		initDiagrams();
		const element = await rendered();
		expect(element.dataset.rendered).toBe("true");
		expect(element.querySelector(".diagram-canvas svg.pele")).not.toBeNull();
		expect(element.querySelector("pre.diagram-source")?.textContent).toBe(FLOWCHART);
		expect([roleOf(element, "Start"), roleOf(element, "Check"), roleOf(element, "Store"), roleOf(element, "Done"), roleOf(element, "Person")]).toEqual([
			"entry",
			"decision",
			"store",
			"outcome",
			"person",
		]);
		expect(roleOf(element, "Styled")).toBeNull();
	});

	it("gives each sequence participant its own hue, on its box and its lifeline", async () => {
		document.body.innerHTML = figure("sequenceDiagram\n  participant A\n  participant B\n  A->>B: hello\n  B-->>A: hi");
		initDiagrams();
		const element = await rendered();
		const hues = (id: string): string[] => [...element.querySelectorAll(`[data-id="${id}"][data-hue]`)].map((node) => node.getAttribute("data-hue") ?? "");
		expect(new Set(hues("A"))).toEqual(new Set(["1"]));
		expect(new Set(hues("B"))).toEqual(new Set(["2"]));
		expect(element.querySelector('.pele-lifeline[data-id="A"]')?.getAttribute("data-hue")).toBe("1");
	});

	it("keeps the source visible and flags the figure when a diagram does not parse", async () => {
		document.body.innerHTML = figure("sequenceDiagram\n  A->>B: first; second");
		initDiagrams();
		const element = await rendered();
		expect(element.dataset.error).toBe("true");
		expect(element.dataset.rendered).toBeUndefined();
		expect(element.querySelector(".diagram-canvas")).toBeNull();
		expect(mountCalls.count).toBe(0);
	});

	it("marks the figure busy until it is drawn", async () => {
		document.body.innerHTML = figure("flowchart TD\n  A --> B");
		initDiagrams();
		expect(document.querySelector("figure.diagram")?.getAttribute("aria-busy")).toBe("true");
		await rendered();
	});
});
