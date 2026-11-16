/**
 * What each node of a flowchart is for, so every place that draws the docs' diagrams colours them with the same
 * meaning: the docs site (from the drawn shapes, `apps/docs/src/browser/diagrams.ts`) and Notion (from the parsed
 * source, `packages/docs-sync/src/sources/notion/notion-diagram-style.ts`). Each caller says which role a shape
 * means, because each one sees shapes differently; the place in the graph is decided here, once.
 */

export type DiagramRole = "entry" | "step" | "store" | "decision" | "outcome" | "person";

/** Every role, in the order a legend or a style block lists them. */
export const DIAGRAM_ROLES: readonly DiagramRole[] = ["entry", "step", "store", "decision", "outcome", "person"];

export interface RoleGraphNode {
	readonly id: string;
	/** Classes the author gave the node (`:::name`, `class id name`). */
	readonly classes: readonly string[];
	/** Styles the author gave the node (`style id …`). */
	readonly styles: readonly string[];
}

export interface RoleGraphEdge {
	readonly start: string;
	readonly end: string;
}

export interface RoleGraph {
	readonly nodes: Iterable<RoleGraphNode>;
	readonly edges: readonly RoleGraphEdge[];
}

/**
 * The role of every node: the role its shape means, if it has one (a cylinder is a store, a diamond a decision, a
 * circle a person); otherwise a node nothing points to is an entry point, one that points to nothing an outcome, and
 * the rest are steps. A node the author styled keeps the author's colours, so it gets no role.
 */
export function flowchartRoles(graph: RoleGraph, shapeRoleOf: (id: string) => DiagramRole | undefined): Map<string, DiagramRole> {
	const incoming = new Set(graph.edges.map((edge) => edge.end));
	const outgoing = new Set(graph.edges.map((edge) => edge.start));
	const roles = new Map<string, DiagramRole>();
	for (const node of graph.nodes) {
		if (node.classes.length > 0 || node.styles.length > 0) {
			continue;
		}
		const shapeRole = shapeRoleOf(node.id);
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
