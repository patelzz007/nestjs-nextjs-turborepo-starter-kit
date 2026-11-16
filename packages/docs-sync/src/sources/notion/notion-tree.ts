import type { DocsSyncIssue } from "@workspace/docs-content/document";

/**
 * The folder tree of the Docs Published database (ADR 084). A row is a page or a folder; each has a Parent that is a
 * folder, or none at the top. A row's Slug is only its own part of the address, and a page's full slug is the path
 * of folder slugs above it: `technical` › `api` › `rest-conventions` is `technical/api/rest-conventions`. So moving
 * a page or renaming a folder in Notion moves the page on the site, and the engine adds the redirect.
 */

/** Deeper than any real docs tree, and short enough that a mistake is found quickly. */
const MAX_FOLDER_DEPTH = 20;
const SLUG_SEPARATOR = "/";

export type TreeRowKind = "page" | "folder";

/** What the tree needs to know about one row. */
export interface TreeRow {
	readonly id: string;
	readonly kind: TreeRowKind;
	readonly title: string;
	/** This row's own part of the address; null when the Slug property is empty. */
	readonly ownSlug: string | null;
	/** The rows its Parent property points at: none at the top, one inside a folder. */
	readonly parentIds: readonly string[];
}

/** A page's full slug, or null with the reasons it cannot have one. */
export interface TreePlacement {
	readonly slug: string | null;
	readonly issues: readonly DocsSyncIssue[];
}

function treeIssue(reason: string, fix: string): DocsSyncIssue {
	return { blockId: null, blockType: null, reason, fix };
}

function named(row: TreeRow): string {
	return `"${row.title.length === 0 ? "Untitled" : row.title}"`;
}

/** The problem with one row's own Slug and Parent, before looking any further up. */
function ownProblem(row: TreeRow, isStart: boolean): DocsSyncIssue | null {
	const who = isStart ? "This page's" : `The folder ${named(row)}'s`;
	if (row.ownSlug === null) {
		// A page with no Slug gets the shared "no slug" message; only a folder needs saying here.
		return isStart ? null : treeIssue(`The folder ${named(row)} has no Slug.`, "Give the folder a Slug: it becomes its part of every address below it.");
	}
	if (row.ownSlug.includes(SLUG_SEPARATOR)) {
		return treeIssue(
			`${who} Slug "${row.ownSlug}" has a "/" in it.`,
			"A Slug is only one part of the address. Put the page inside folders with Parent, and keep just its own name in Slug.",
		);
	}
	if (row.parentIds.length > 1) {
		return treeIssue(`${isStart ? "This page" : `The folder ${named(row)}`} has more than one Parent.`, "Choose one folder in Parent.");
	}
	return null;
}

/** Where a page sits: its full slug from the folders above it, or why it has none. */
export function placementOf(page: TreeRow, rows: ReadonlyMap<string, TreeRow>): TreePlacement {
	const segments: string[] = [];
	const visited = new Set<string>();
	let row: TreeRow = page;
	for (let depth = 0; depth <= MAX_FOLDER_DEPTH; depth += 1) {
		const problem = ownProblem(row, row === page);
		if (problem !== null) {
			return { slug: null, issues: [problem] };
		}
		if (row.ownSlug === null) {
			return { slug: null, issues: [] };
		}
		segments.unshift(row.ownSlug);
		visited.add(row.id);
		const [parentId] = row.parentIds;
		if (parentId === undefined) {
			return { slug: segments.join(SLUG_SEPARATOR), issues: [] };
		}
		const parent = rows.get(parentId);
		if (parent === undefined) {
			return {
				slug: null,
				issues: [
					treeIssue(
						`The Parent of ${row === page ? "this page" : `the folder ${named(row)}`} is not a published folder.`,
						"Set Parent to a folder in Docs Published (Kind: Folder), or clear it to put the page at the top.",
					),
				],
			};
		}
		if (parent.kind !== "folder") {
			return {
				slug: null,
				issues: [
					treeIssue(
						`The Parent of ${row === page ? "this page" : `the folder ${named(row)}`} is the page ${named(parent)}, not a folder.`,
						"Set Parent to a folder (Kind: Folder).",
					),
				],
			};
		}
		if (visited.has(parent.id)) {
			return { slug: null, issues: [treeIssue(`The folder ${named(parent)} is inside itself.`, "Change a Parent so the folders no longer go round in a circle.")] };
		}
		row = parent;
	}
	return { slug: null, issues: [treeIssue(`This page is more than ${String(MAX_FOLDER_DEPTH)} folders deep.`, "Move it into a shallower folder.")] };
}
