import { describe, expect, it } from "vitest";

import { DIAGRAM_ROLES, flowchartRoles, type DiagramRole, type RoleGraph, type RoleGraphNode } from "../diagram-roles.ts";

function node(id: string, styled: Partial<Pick<RoleGraphNode, "classes" | "styles">> = {}): RoleGraphNode {
	return { id, classes: [], styles: [], ...styled };
}

/** Start → Check → Store → Done, Check → Person → Done, Hot → Done, Painted → Done, and Alone with no edges. */
const GRAPH: RoleGraph = {
	nodes: [
		node("Start"),
		node("Check"),
		node("Store"),
		node("Done"),
		node("Person"),
		node("Hot", { classes: ["hot"] }),
		node("Painted", { styles: ["fill:#f00"] }),
		node("Alone"),
	],
	edges: [
		{ start: "Start", end: "Check" },
		{ start: "Check", end: "Store" },
		{ start: "Store", end: "Done" },
		{ start: "Check", end: "Person" },
		{ start: "Person", end: "Done" },
		{ start: "Hot", end: "Done" },
		{ start: "Painted", end: "Done" },
	],
};

const SHAPES: Readonly<Record<string, DiagramRole>> = { Check: "decision", Store: "store", Person: "person" };

describe("flowchartRoles", () => {
	it("takes a shape's role first, then the node's place in the graph, and skips nodes the author styled", () => {
		expect(Object.fromEntries(flowchartRoles(GRAPH, (id) => SHAPES[id]))).toEqual({
			Start: "entry",
			Check: "decision",
			Store: "store",
			Done: "outcome",
			Person: "person",
			Alone: "step",
		});
	});

	it("calls a node in the middle of a chain a step", () => {
		const chain: RoleGraph = {
			nodes: [node("A"), node("B"), node("C")],
			edges: [
				{ start: "A", end: "B" },
				{ start: "B", end: "C" },
			],
		};
		expect(flowchartRoles(chain, () => undefined).get("B")).toBe("step");
	});

	it("lists every role once", () => {
		expect(new Set(DIAGRAM_ROLES).size).toBe(DIAGRAM_ROLES.length);
	});
});
