// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PermissionTreeGroupNode } from "@/lib/permissions/build-permission-tree";

import { AccessPermissionExplorerTree } from "../access-permission-explorer-tree";

afterEach((): void => {
	cleanup();
});

// "Users" / "user" are redundant labels, so that group is shown flat (group → action);
// "Billing" keeps its resources (group → resource → action).
const GROUPS: readonly PermissionTreeGroupNode[] = [
	{
		group: "Users",
		resources: [
			{
				resource: "user",
				permissions: [
					{ id: "p1", action: "READ", resource: "user", description: "Read a user", isSystem: true },
					{ id: "p2", action: "DELETE", resource: "user", description: "Delete a user", isSystem: false },
				],
			},
		],
	},
	{
		group: "Billing",
		resources: [
			{ resource: "invoice", permissions: [{ id: "p3", action: "LIST", resource: "invoice", description: null, isSystem: false }] },
			{ resource: "refund", permissions: [{ id: "p4", action: "CREATE", resource: "refund", description: "Issue a refund", isSystem: false }] },
		],
	},
];

function rowNames(): string[] {
	return screen.getAllByRole("treeitem").map((row) => row.textContent);
}

describe("AccessPermissionExplorerTree", () => {
	it("starts collapsed, showing each group with its permission count", (): void => {
		render(<AccessPermissionExplorerTree groups={GROUPS} />);
		expect(screen.getByRole("tree", { name: "Permission catalog" })).toBeTruthy();
		expect(rowNames()).toEqual(["Users2", "Billing2"]);
	});

	it("opens every branch with expand all and closes them with collapse all", (): void => {
		render(<AccessPermissionExplorerTree groups={GROUPS} />);
		fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
		expect(rowNames()).toEqual(["Users2", "READ", "DELETE", "Billing2", "invoice1", "LIST", "refund1", "CREATE"]);
		fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
		expect(rowNames()).toEqual(["Users2", "Billing2"]);
	});

	it("starts expanded with defaultOpen", (): void => {
		render(<AccessPermissionExplorerTree groups={GROUPS} defaultOpen />);
		expect(rowNames()).toHaveLength(8);
	});

	it("filters by search and opens the branches that still match", (): void => {
		render(<AccessPermissionExplorerTree groups={GROUPS} />);
		fireEvent.change(screen.getByRole("textbox", { name: "Search permissions" }), { target: { value: "refund" } });
		expect(rowNames()).toEqual(["Billing1", "refund1", "CREATE"]);
	});

	it("explains an empty search instead of rendering an empty tree", (): void => {
		render(<AccessPermissionExplorerTree groups={GROUPS} />);
		fireEvent.change(screen.getByRole("textbox", { name: "Search permissions" }), { target: { value: "nothing-matches" } });
		expect(screen.queryByRole("tree")).toBeNull();
		expect(screen.getByText("No permissions match your search.")).toBeTruthy();
	});

	it("shows an action's details when its row is selected, and ignores folder rows", (): void => {
		render(<AccessPermissionExplorerTree groups={GROUPS} defaultOpen />);
		fireEvent.click(screen.getByRole("treeitem", { name: "Billing" }));
		expect(screen.getByText("Select a permission")).toBeTruthy();
		fireEvent.click(screen.getByRole("treeitem", { name: "DELETE" }));
		expect(screen.queryByText("Select a permission")).toBeNull();
		expect(screen.getByText("Delete a user")).toBeTruthy();
	});

	it("renders the empty message when there are no permissions at all", (): void => {
		render(<AccessPermissionExplorerTree groups={[]} emptyMessage="Nothing here." />);
		expect(screen.getByText("Nothing here.")).toBeTruthy();
	});
});
