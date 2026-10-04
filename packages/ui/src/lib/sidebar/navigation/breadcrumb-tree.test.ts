import { FileText } from "lucide-react";
import { describe, expect, it } from "vitest";

import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";

import { findDeepestNavMatch, longestSharedPrefix, replaceLastTrailItem, segmentsOfPath, updateLastTrailItem, type NavTreeShape } from "./breadcrumb-tree";

interface TestNode {
	readonly id: string;
	readonly url: string;
	readonly children?: readonly TestNode[];
}

const SHAPE: NavTreeShape<TestNode> = {
	getUrl: (node: TestNode): string => node.url,
	getChildren: (node: TestNode): readonly TestNode[] => node.children ?? [],
};

function matchedIds(roots: readonly TestNode[], pathname: string): { readonly kind: string; readonly ids: readonly string[] } | null {
	const match = findDeepestNavMatch(roots, pathname, SHAPE);
	return match === null ? null : { kind: match.kind, ids: match.chain.map((node) => node.id) };
}

describe("breadcrumb-tree", () => {
	it("longestSharedPrefix compares arbitrary segment types via equals", () => {
		const left: readonly number[] = [1, 2, 3];
		const right: readonly number[] = [1, 2, 9];
		expect(longestSharedPrefix(left, right, (a, b) => a === b)).toBe(2);
	});

	it("findDeepestNavMatch resolves an exact nested path through its ancestors", () => {
		const roots: readonly TestNode[] = [{ id: "settings", url: "/settings", children: [{ id: "general", url: "/settings/general" }] }];
		expect(matchedIds(roots, "/settings/general")).toEqual({ kind: "exact", ids: ["settings", "general"] });
	});

	it("findDeepestNavMatch anchors on a nested leaf ancestor", () => {
		const roots: readonly TestNode[] = [{ id: "catalog", url: "/catalog", children: [{ id: "products", url: "/catalog/products" }] }];
		expect(matchedIds(roots, "/catalog/products/42/edit")).toEqual({ kind: "ancestor", ids: ["catalog", "products"] });
	});

	it("findDeepestNavMatch prefers the longest match across roots and ignores look-alike prefixes", () => {
		const roots: readonly TestNode[] = [
			{ id: "users", url: "/users" },
			{ id: "roles", url: "/users/roles" },
		];
		expect(matchedIds(roots, "/users/roles/admins")).toEqual({ kind: "ancestor", ids: ["roles"] });
		expect(matchedIds(roots, "/users-x")).toBeNull();
	});

	it("findDeepestNavMatch does not crumb a child that shares its parent's URL twice", () => {
		const roots: readonly TestNode[] = [{ id: "users", url: "/users", children: [{ id: "all-users", url: "/users" }] }];
		expect(matchedIds(roots, "/users/123")).toEqual({ kind: "ancestor", ids: ["users"] });
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
