import { FileText } from "lucide-react";
import { describe, expect, it } from "vitest";

import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";

import {
	bestSharedSegmentPrefix,
	flattenNavTree,
	longestSharedPrefix,
	updateLastTrailItem,
	type NavTreeAdapter,
	segmentsOfPath,
	walkNavTreeForPath,
	replaceLastTrailItem,
} from "@workspace/ui/lib/navigation/breadcrumb-tree";

interface TestNode {
	readonly id: string;
	readonly url: string;
	readonly children?: readonly TestNode[];
}

const testAdapter: NavTreeAdapter<TestNode> = {
	getUrl: (node: TestNode): string => node.url,
	getChildren: (node: TestNode): readonly TestNode[] => node.children ?? [],
	toLinkedCrumb: (node: TestNode): BreadcrumbItem => ({ label: node.id, href: node.url, icon: FileText }),
	toCurrentCrumb: (node: TestNode): BreadcrumbItem => ({ label: node.id, icon: FileText }),
};

describe("breadcrumb-tree", () => {
	it("longestSharedPrefix compares arbitrary segment types via equals", () => {
		const left: readonly number[] = [1, 2, 3];
		const right: readonly number[] = [1, 2, 9];
		expect(longestSharedPrefix(left, right, (a, b) => a === b)).toBe(2);
	});

	it("flattenNavTree visits every node once", () => {
		const roots: readonly TestNode[] = [
			{
				id: "a",
				url: "/a",
				children: [{ id: "b", url: "/a/b", children: [{ id: "c", url: "/a/b/c" }] }],
			},
		];
		const flat = flattenNavTree(roots, testAdapter.getChildren);
		expect(flat.map((node) => node.id)).toEqual(["a", "b", "c"]);
	});

	it("walkNavTreeForPath resolves nested paths", () => {
		const roots: readonly TestNode[] = [
			{
				id: "settings",
				url: "/settings",
				children: [{ id: "general", url: "/settings/general" }],
			},
		];
		const trail: BreadcrumbItem[] = [];
		expect(walkNavTreeForPath(roots, "/settings/general", trail, testAdapter)).toBe(true);
		expect(trail.map((crumb) => crumb.label)).toEqual(["settings", "general"]);
	});

	it("bestSharedSegmentPrefix picks the longest menu match", () => {
		const nodes: readonly TestNode[] = [
			{ id: "users", url: "/users/all" },
			{ id: "roles", url: "/users/roles" },
		];
		expect(bestSharedSegmentPrefix("/users/roles/admins", nodes, testAdapter.getUrl)).toBe(2);
		expect(bestSharedSegmentPrefix("/users/123", nodes, testAdapter.getUrl)).toBe(1);
	});

	it("replaceLastTrailItem and updateLastTrailItem replace only the final item", () => {
		const trail: readonly BreadcrumbItem[] = [
			{ label: "Users", href: "/users/all", icon: FileText },
			{ label: "123", icon: FileText },
		];
		expect(replaceLastTrailItem(trail, { label: "Tail", icon: FileText }).map((crumb) => crumb.label)).toEqual(["Users", "Tail"]);
		expect(updateLastTrailItem(trail, (last) => ({ ...last, label: "Named" })).map((crumb) => crumb.label)).toEqual(["Users", "Named"]);
	});

	it("segmentsOfPath strips empty segments", () => {
		expect(segmentsOfPath("/users/123/")).toEqual(["users", "123"]);
	});
});
