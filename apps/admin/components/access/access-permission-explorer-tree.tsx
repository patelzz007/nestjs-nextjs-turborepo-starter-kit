"use client";

import { permissionActionFallbackIcon, permissionActionIcon, permissionActionIconClassName } from "@/lib/permissions/permission-action-style";
import { isRedundantResourceLabel } from "@/lib/permissions/permission-label-utils";
import type { PermissionTreeGroupNode, PermissionTreeLeaf, PermissionTreeResourceNode } from "@/lib/permissions/build-permission-tree";
import { AccessPermissionDetailPanel, type AccessPermissionDetailItem } from "@/components/access/access-permission-detail-panel";
import { LIST_SLOT_INDEX, PermissionActionSchema, type PermissionAction } from "@workspace/shared";
import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature, type ItemInstance } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Tree, TreeItem, TreeItemLabel } from "@workspace/ui/components/tree";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronsDownUp, ChevronsUpDown, Folder, FolderOpen, Search, X } from "lucide-react";
import * as React from "react";

export interface AccessPermissionExplorerTreeProps {
	readonly groups: readonly PermissionTreeGroupNode[];
	readonly emptyMessage?: string;
	readonly defaultOpen?: boolean;
}

type PermissionTreeDisplay =
	{ readonly kind: "flat"; readonly permissions: readonly PermissionTreeLeaf[] } | { readonly kind: "nested"; readonly resources: readonly PermissionTreeResourceNode[] };

interface SelectedPermissionState extends AccessPermissionDetailItem {
	readonly relatedActions: readonly string[];
}

function resolveGroupDisplay(groupNode: PermissionTreeGroupNode): PermissionTreeDisplay {
	if (groupNode.resources.length === 1) {
		const onlyResource: PermissionTreeResourceNode | undefined = groupNode.resources[LIST_SLOT_INDEX.first];
		if (onlyResource !== undefined) {
			const redundant: boolean = isRedundantResourceLabel(groupNode.group, onlyResource.resource);
			if (redundant) {
				return { kind: "flat", permissions: onlyResource.permissions };
			}
		}
	}
	return { kind: "nested", resources: groupNode.resources };
}

function countPermissionsInGroup(groupNode: PermissionTreeGroupNode): number {
	return groupNode.resources.reduce((total, resourceNode) => total + resourceNode.permissions.length, 0);
}

function matchesQuery(permission: PermissionTreeLeaf, groupName: string, query: string): boolean {
	const haystack = [groupName, permission.resource, permission.action, permission.description ?? ""].join(" ").toLowerCase();
	return haystack.includes(query);
}

function filterGroups(groups: readonly PermissionTreeGroupNode[], query: string): readonly PermissionTreeGroupNode[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (normalizedQuery.length === 0) {
		return groups;
	}

	const filtered: PermissionTreeGroupNode[] = [];
	for (const groupNode of groups) {
		const resources: PermissionTreeResourceNode[] = [];
		for (const resourceNode of groupNode.resources) {
			const permissions = resourceNode.permissions.filter((permission) => matchesQuery(permission, groupNode.group, normalizedQuery));
			if (permissions.length > 0) {
				resources.push({ resource: resourceNode.resource, permissions });
			}
		}
		if (resources.length > 0) {
			filtered.push({ group: groupNode.group, resources });
		}
	}
	return filtered;
}

function parsePermissionAction(action: string): PermissionAction | null {
	const parsed = PermissionActionSchema.safeParse(action);
	return parsed.success ? parsed.data : null;
}

function findRelatedActions(groups: readonly PermissionTreeGroupNode[], resource: string, excludeId: string): readonly string[] {
	const actions: string[] = [];
	for (const groupNode of groups) {
		for (const resourceNode of groupNode.resources) {
			if (resourceNode.resource !== resource) {
				continue;
			}
			for (const permission of resourceNode.permissions) {
				if (permission.id !== excludeId) {
					actions.push(permission.action);
				}
			}
		}
	}
	return [...new Set(actions)].sort((left, right) => left.localeCompare(right));
}

function buildSelectedPermission(permission: PermissionTreeLeaf, groupName: string, groups: readonly PermissionTreeGroupNode[]): SelectedPermissionState {
	const relatedOnResource = findRelatedActions(groups, permission.resource, permission.id);
	return {
		id: permission.id,
		action: permission.action,
		resource: permission.resource,
		description: permission.description,
		group: groupName,
		isSystem: permission.isSystem,
		relatedActions: [permission.action, ...relatedOnResource],
	};
}

// ── Tree model: group → resource → action, as headless-tree items ─────────────

const ROOT_ID = "root";
/** Pixels each tree level is indented by. */
const TREE_INDENT_PX = 16;

type ExplorerNode =
	| { readonly kind: "root"; readonly children: readonly string[] }
	| { readonly kind: "group"; readonly name: string; readonly count: number; readonly children: readonly string[] }
	| { readonly kind: "resource"; readonly name: string; readonly count: number; readonly children: readonly string[] }
	| { readonly kind: "permission"; readonly permission: PermissionTreeLeaf; readonly groupName: string };

/** Stands in for an id that left the data between a rebuild and a read. */
const MISSING_NODE: ExplorerNode = { kind: "root", children: [] };

function groupId(group: string): string {
	return `group:${group}`;
}

function resourceId(group: string, resource: string): string {
	return `${groupId(group)}:${resource}`;
}

function permissionId(permission: PermissionTreeLeaf): string {
	return `permission:${permission.id}`;
}

function buildExplorerNodes(groups: readonly PermissionTreeGroupNode[]): ReadonlyMap<string, ExplorerNode> {
	const nodes = new Map<string, ExplorerNode>();
	const addPermissions = (permissions: readonly PermissionTreeLeaf[], groupName: string): readonly string[] =>
		permissions.map((permission) => {
			const id = permissionId(permission);
			nodes.set(id, { kind: "permission", permission, groupName });
			return id;
		});

	const groupIds = groups.map((groupNode) => {
		const display = resolveGroupDisplay(groupNode);
		const children =
			display.kind === "flat"
				? addPermissions(display.permissions, groupNode.group)
				: display.resources.map((resourceNode) => {
						const id = resourceId(groupNode.group, resourceNode.resource);
						nodes.set(id, {
							kind: "resource",
							name: resourceNode.resource,
							count: resourceNode.permissions.length,
							children: addPermissions(resourceNode.permissions, groupNode.group),
						});
						return id;
					});
		const id = groupId(groupNode.group);
		nodes.set(id, { kind: "group", name: groupNode.group, count: countPermissionsInGroup(groupNode), children });
		return id;
	});

	nodes.set(ROOT_ID, { kind: "root", children: groupIds });
	return nodes;
}

/** Every folder id (groups and nested resources) — what "expand all" opens. */
function collectBranchIds(groups: readonly PermissionTreeGroupNode[]): string[] {
	const ids: string[] = [];
	for (const groupNode of groups) {
		ids.push(groupId(groupNode.group));
		const display = resolveGroupDisplay(groupNode);
		if (display.kind === "nested") {
			for (const resourceNode of display.resources) {
				ids.push(resourceId(groupNode.group, resourceNode.resource));
			}
		}
	}
	return ids;
}

function nodeChildren(node: ExplorerNode | undefined): string[] {
	return node === undefined || node.kind === "permission" ? [] : [...node.children];
}

function nodeName(node: ExplorerNode): string {
	switch (node.kind) {
		case "root":
			return "";
		case "group":
		case "resource":
			return node.name;
		case "permission":
			return node.permission.action;
	}
}

/**
 * The action's icon element. The icon components are module-level constants
 * looked up by action, so their identity is stable across renders.
 */
function actionIconElement(action: PermissionAction | null): React.JSX.Element {
	const ActionIcon = action !== null ? permissionActionIcon(action) : permissionActionFallbackIcon();
	const iconClassName = action !== null ? permissionActionIconClassName(action) : "text-muted-foreground";
	return <ActionIcon className={cn("size-4", iconClassName)} aria-hidden="true" />;
}

interface ExplorerTreeRowProps {
	readonly item: ItemInstance<ExplorerNode>;
}

/** One row: a folder (group or resource) with its permission count, or an action leaf. */
function ExplorerTreeRow({ item }: ExplorerTreeRowProps): React.JSX.Element {
	const node = item.getItemData();

	if (node.kind === "permission") {
		return (
			<TreeItem item={item} title={node.permission.description ?? undefined}>
				<TreeItemLabel className="gap-2">
					{actionIconElement(parsePermissionAction(node.permission.action))}
					<span className="min-w-0 flex-1 truncate font-mono text-xs tracking-wide">{node.permission.action}</span>
				</TreeItemLabel>
			</TreeItem>
		);
	}

	const FolderIcon = item.isExpanded() ? FolderOpen : Folder;
	const count = node.kind === "root" ? 0 : node.count;
	return (
		<TreeItem item={item}>
			<TreeItemLabel className="gap-2 font-medium">
				<FolderIcon className="size-4 text-primary" aria-hidden="true" />
				<span className={cn("min-w-0 flex-1 truncate", node.kind === "resource" && "font-mono text-xs")}>{item.getItemName()}</span>
				<Badge variant="secondary" size="sm" className="tabular-nums">
					{String(count)}
				</Badge>
			</TreeItemLabel>
		</TreeItem>
	);
}

/**
 * Compact file-explorer permission catalog (group → resource → action).
 */
export const AccessPermissionExplorerTree = React.forwardRef<HTMLDivElement, AccessPermissionExplorerTreeProps>(function AccessPermissionExplorerTree(
	{ groups, emptyMessage = "No permissions.", defaultOpen = false },
	ref,
): React.JSX.Element {
	const [query, setQuery] = React.useState("");
	const [selectedPermission, setSelectedPermission] = React.useState<SelectedPermissionState | null>(null);
	const [expandedItems, setExpandedItems] = React.useState<string[]>(() => (defaultOpen ? collectBranchIds(groups) : []));
	const [focusedItem, setFocusedItem] = React.useState<string | null>(null);

	const filteredGroups = React.useMemo(() => filterGroups(groups, query), [groups, query]);
	const totalCount = React.useMemo(() => groups.reduce((total, groupNode) => total + countPermissionsInGroup(groupNode), 0), [groups]);
	const visibleCount = React.useMemo(() => filteredGroups.reduce((total, groupNode) => total + countPermissionsInGroup(groupNode), 0), [filteredGroups]);
	const nodes = React.useMemo(() => buildExplorerNodes(filteredGroups), [filteredGroups]);
	const selectedItems = React.useMemo(() => (selectedPermission === null ? [] : [`permission:${selectedPermission.id}`]), [selectedPermission]);

	// Selecting a folder only expands it; only an action row changes the detail panel.
	const handleSelectedItemsChange = React.useCallback(
		(update: string[] | ((previous: string[]) => string[])): void => {
			const next = update instanceof Function ? update(selectedItems) : update;
			for (const id of [...next].reverse()) {
				const node = nodes.get(id);
				if (node?.kind === "permission") {
					setSelectedPermission(buildSelectedPermission(node.permission, node.groupName, groups));
					return;
				}
			}
		},
		[groups, nodes, selectedItems],
	);

	const tree = useTree<ExplorerNode>({
		rootItemId: ROOT_ID,
		indent: TREE_INDENT_PX,
		getItemName: (item) => nodeName(item.getItemData()),
		isItemFolder: (item) => item.getItemData().kind !== "permission",
		dataLoader: {
			getItem: (itemId) => nodes.get(itemId) ?? MISSING_NODE,
			getChildren: (itemId) => nodeChildren(nodes.get(itemId)),
		},
		state: { expandedItems, selectedItems, focusedItem },
		setExpandedItems,
		setSelectedItems: handleSelectedItemsChange,
		setFocusedItem,
		features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
	});

	// The loader reads `nodes`; rebuild the item cache whenever the (filtered) data changes.
	React.useEffect((): void => {
		tree.rebuildTree();
	}, [nodes, tree]);

	const handleExpandAll = React.useCallback((): void => {
		setExpandedItems(collectBranchIds(filteredGroups));
	}, [filteredGroups]);

	const handleCollapseAll = React.useCallback((): void => {
		setExpandedItems([]);
	}, []);

	// A search opens every branch that still has matches, so they are visible at once.
	const handleQueryChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const nextQuery = event.target.value;
			setQuery(nextQuery);
			if (nextQuery.trim().length > 0) {
				setExpandedItems(collectBranchIds(filterGroups(groups, nextQuery)));
			}
		},
		[groups],
	);

	const handleClearQuery = React.useCallback((): void => {
		setQuery("");
	}, []);

	const handleSelectRelatedAction = React.useCallback(
		(action: string): void => {
			if (selectedPermission === null) {
				return;
			}
			for (const groupNode of groups) {
				for (const resourceNode of groupNode.resources) {
					if (resourceNode.resource !== selectedPermission.resource) {
						continue;
					}
					const match = resourceNode.permissions.find((permission) => permission.action === action);
					if (match !== undefined) {
						setSelectedPermission(buildSelectedPermission(match, groupNode.group, groups));
						return;
					}
				}
			}
		},
		[groups, selectedPermission],
	);

	if (groups.length === 0) {
		return (
			<p ref={ref} className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
				{emptyMessage}
			</p>
		);
	}

	return (
		<div ref={ref} className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative min-w-0 flex-1 sm:max-w-sm">
					<Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
					<Input value={query} onChange={handleQueryChange} placeholder="Search groups, resources, actions…" className="ps-9 pe-9" aria-label="Search permissions" />
					{query.length > 0 ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="absolute end-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
							onClick={handleClearQuery}
							aria-label="Clear search">
							<X className="size-3.5" />
						</Button>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<Button type="button" variant="outline" size="sm" onClick={handleExpandAll}>
						<ChevronsUpDown className="size-3.5" />
						Expand all
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={handleCollapseAll}>
						<ChevronsDownUp className="size-3.5" />
						Collapse all
					</Button>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
				<ScrollArea className="h-[min(36rem,65vh)] rounded-lg border border-border bg-muted/20">
					{filteredGroups.length === 0 ? (
						<p className="px-2 py-8 text-center text-sm text-muted-foreground">No permissions match your search.</p>
					) : (
						<Tree tree={tree} indent={TREE_INDENT_PX} aria-label="Permission catalog" className="p-2">
							{tree.getItems().map((item) => (
								<ExplorerTreeRow key={item.getId()} item={item} />
							))}
						</Tree>
					)}
				</ScrollArea>

				<div className="lg:sticky lg:top-4 lg:self-start">
					<AccessPermissionDetailPanel
						permission={selectedPermission}
						relatedActions={selectedPermission?.relatedActions ?? []}
						totalCount={totalCount}
						visibleCount={visibleCount}
						onSelectRelatedAction={handleSelectRelatedAction}
					/>
				</div>
			</div>
		</div>
	);
});
