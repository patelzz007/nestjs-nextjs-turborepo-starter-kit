"use client";

import type * as React from "react";

import { DataTable, type DataTableColumns, type DataTableSearch, type DataTableTree } from "@workspace/ui/components/data-table";

import { NUMERIC_COLUMN_META } from "./data-table-sample";

/** One entry of the proposal's outline. A chapter holds the sections under it. */
interface OutlineNode {
	readonly id: string;
	readonly title: string;
	readonly pages: number;
	readonly owner: string;
	readonly children?: OutlineNode[];
}

const OUTLINE: readonly OutlineNode[] = [
	{
		id: "front",
		title: "Front matter",
		pages: 12,
		owner: "Eddie Lake",
		children: [
			{ id: "front-cover", title: "Cover page", pages: 1, owner: "Eddie Lake" },
			{ id: "front-contents", title: "Table of contents", pages: 2, owner: "Eddie Lake" },
			{ id: "front-summary", title: "Executive summary", pages: 9, owner: "Sarah Chen" },
		],
	},
	{
		id: "approach",
		title: "Technical approach",
		pages: 41,
		owner: "Jamik Tashpulatov",
		children: [
			{ id: "approach-design", title: "Design", pages: 14, owner: "Jamik Tashpulatov" },
			{
				id: "approach-architecture",
				title: "System architecture",
				pages: 27,
				owner: "Maya Johnson",
				children: [
					{ id: "approach-architecture-api", title: "API documentation", pages: 12, owner: "Raj Patel" },
					{ id: "approach-architecture-security", title: "Security and data protection", pages: 15, owner: "Leila Ahmadi" },
				],
			},
		],
	},
	{ id: "pricing", title: "Financial projections", pages: 16, owner: "Maya Johnson" },
];

function getNodeId(node: OutlineNode): string {
	return node.id;
}

function getChildren(node: OutlineNode): OutlineNode[] | undefined {
	return node.children;
}

// The first column carries the toggle and the indent.
const COLUMNS: DataTableColumns<OutlineNode> = [
	{ accessorKey: "title", header: "Section", size: 340 },
	{ accessorKey: "pages", header: "Pages", size: 100, meta: NUMERIC_COLUMN_META },
	{ accessorKey: "owner", header: "Owner", size: 200 },
];

/** `getSubRows` reads a row's children; `defaultExpanded` opens every branch to start with. */
const TREE: DataTableTree<OutlineNode> = { getSubRows: getChildren, defaultExpanded: true };

const SEARCH: DataTableSearch<OutlineNode> = { keys: ["title", "owner"] };

/**
 * Rows that hold rows. Sorting orders each level on its own, so a child never leaves its parent. Search for "API":
 * the match keeps the chapters above it, and its branch is opened for you. Clear the search and the branches go back
 * to how you left them.
 */
export function DataTable21Example(): React.JSX.Element {
	return <DataTable data={OUTLINE} columns={COLUMNS} getRowId={getNodeId} tree={TREE} search={SEARCH} />;
}
