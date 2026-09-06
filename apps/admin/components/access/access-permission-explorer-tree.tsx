"use client";

import { permissionActionFallbackIcon, permissionActionIcon, permissionActionIconClassName } from "@/lib/permission-action-style";
import { isRedundantResourceLabel } from "@/lib/permission-label-utils";
import type { PermissionTreeGroupNode, PermissionTreeLeaf, PermissionTreeResourceNode } from "@/lib/build-permission-tree";
import { AccessPermissionDetailPanel, type AccessPermissionDetailItem } from "@/components/access/access-permission-detail-panel";
import { PermissionActionSchema, type PermissionAction } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { TreeBranch, TreeLeaf, TreeView } from "@workspace/ui/components/navigation/tree-view";
import { ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
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
		const onlyResource: PermissionTreeResourceNode | undefined = groupNode.resources[0];
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

interface ExplorerPermissionLeafProps {
	readonly permission: PermissionTreeLeaf;
	readonly groupName: string;
	readonly groups: readonly PermissionTreeGroupNode[];
	readonly selectedId: string | null;
	readonly onSelect: (permission: SelectedPermissionState) => void;
}

function ExplorerPermissionLeaf({ permission, groupName, groups, selectedId, onSelect }: ExplorerPermissionLeafProps): React.JSX.Element {
	const parsedAction = parsePermissionAction(permission.action);
	const ActionIcon = parsedAction !== null ? permissionActionIcon(parsedAction) : permissionActionFallbackIcon();
	const iconClassName = parsedAction !== null ? permissionActionIconClassName(parsedAction) : "text-muted-foreground";

	const handleSelect = React.useCallback((): void => {
		onSelect(buildSelectedPermission(permission, groupName, groups));
	}, [groupName, groups, onSelect, permission]);

	return (
		<TreeLeaf
			name={permission.action}
			icon={ActionIcon}
			iconClassName={iconClassName}
			mono
			hint={permission.description}
			state={selectedId === permission.id ? "selected" : "default"}
			onSelect={handleSelect}
		/>
	);
}

interface ExplorerPermissionResourceProps {
	readonly resourceNode: PermissionTreeResourceNode;
	readonly groupName: string;
	readonly groups: readonly PermissionTreeGroupNode[];
	readonly resourceBranchKey: string;
	readonly isOpen: boolean;
	readonly onBranchOpenChange: (branchKey: string, open: boolean) => void;
	readonly selectedId: string | null;
	readonly onSelect: (permission: SelectedPermissionState) => void;
}

function ExplorerPermissionResource({
	resourceNode,
	groupName,
	groups,
	resourceBranchKey,
	isOpen,
	onBranchOpenChange,
	selectedId,
	onSelect,
}: ExplorerPermissionResourceProps): React.JSX.Element {
	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			onBranchOpenChange(resourceBranchKey, open);
		},
		[onBranchOpenChange, resourceBranchKey],
	);

	return (
		<TreeBranch name={resourceNode.resource} open={isOpen} onOpenChange={handleOpenChange} count={resourceNode.permissions.length} className="font-mono text-xs">
			{resourceNode.permissions.map((permission) => (
				<ExplorerPermissionLeaf key={permission.id} permission={permission} groupName={groupName} groups={groups} selectedId={selectedId} onSelect={onSelect} />
			))}
		</TreeBranch>
	);
}

interface ExplorerPermissionGroupProps {
	readonly groupNode: PermissionTreeGroupNode;
	readonly groups: readonly PermissionTreeGroupNode[];
	readonly isBranchOpen: (branchKey: string) => boolean;
	readonly onBranchOpenChange: (branchKey: string, open: boolean) => void;
	readonly selectedId: string | null;
	readonly onSelect: (permission: SelectedPermissionState) => void;
}

function ExplorerPermissionGroup({ groupNode, groups, isBranchOpen, onBranchOpenChange, selectedId, onSelect }: ExplorerPermissionGroupProps): React.JSX.Element {
	const branchKey = `group:${groupNode.group}`;
	const display: PermissionTreeDisplay = resolveGroupDisplay(groupNode);

	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			onBranchOpenChange(branchKey, open);
		},
		[branchKey, onBranchOpenChange],
	);

	return (
		<TreeBranch name={groupNode.group} open={isBranchOpen(branchKey)} onOpenChange={handleOpenChange} count={countPermissionsInGroup(groupNode)}>
			{display.kind === "flat"
				? display.permissions.map((permission) => (
						<ExplorerPermissionLeaf key={permission.id} permission={permission} groupName={groupNode.group} groups={groups} selectedId={selectedId} onSelect={onSelect} />
					))
				: display.resources.map((resourceNode) => {
						const resourceBranchKey = `${branchKey}:${resourceNode.resource}`;
						return (
							<ExplorerPermissionResource
								key={resourceBranchKey}
								resourceNode={resourceNode}
								groupName={groupNode.group}
								groups={groups}
								resourceBranchKey={resourceBranchKey}
								isOpen={isBranchOpen(resourceBranchKey)}
								onBranchOpenChange={onBranchOpenChange}
								selectedId={selectedId}
								onSelect={onSelect}
							/>
						);
					})}
		</TreeBranch>
	);
}

function collectBranchKeys(groups: readonly PermissionTreeGroupNode[]): readonly string[] {
	const keys: string[] = [];
	for (const groupNode of groups) {
		const groupKey = `group:${groupNode.group}`;
		keys.push(groupKey);
		const display = resolveGroupDisplay(groupNode);
		if (display.kind === "nested") {
			for (const resourceNode of display.resources) {
				keys.push(`${groupKey}:${resourceNode.resource}`);
			}
		}
	}
	return keys;
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
	const [branchOpenState, setBranchOpenState] = React.useState<Readonly<Record<string, boolean>>>({});

	const filteredGroups = React.useMemo(() => filterGroups(groups, query), [groups, query]);
	const totalCount = React.useMemo(() => groups.reduce((total, groupNode) => total + countPermissionsInGroup(groupNode), 0), [groups]);
	const visibleCount = React.useMemo(() => filteredGroups.reduce((total, groupNode) => total + countPermissionsInGroup(groupNode), 0), [filteredGroups]);
	const branchKeys = React.useMemo(() => collectBranchKeys(filteredGroups), [filteredGroups]);

	const isBranchOpen = React.useCallback(
		(branchKey: string): boolean => {
			const stored = branchOpenState[branchKey];
			if (stored !== undefined) {
				return stored;
			}
			return query.trim().length > 0 ? true : defaultOpen;
		},
		[branchOpenState, defaultOpen, query],
	);

	const handleBranchOpenChange = React.useCallback((branchKey: string, open: boolean): void => {
		setBranchOpenState((current) => ({ ...current, [branchKey]: open }));
	}, []);

	const handleExpandAll = React.useCallback((): void => {
		const nextState: Record<string, boolean> = {};
		for (const key of branchKeys) {
			nextState[key] = true;
		}
		setBranchOpenState(nextState);
	}, [branchKeys]);

	const handleCollapseAll = React.useCallback((): void => {
		const nextState: Record<string, boolean> = {};
		for (const key of branchKeys) {
			nextState[key] = false;
		}
		setBranchOpenState(nextState);
	}, [branchKeys]);

	const handleQueryChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setQuery(event.target.value);
	}, []);

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
				<TreeView scrollable aria-label="Permission catalog" heightClassName="h-[min(36rem,65vh)]">
					{filteredGroups.length === 0 ? (
						<p className="px-2 py-8 text-center text-sm text-muted-foreground">No permissions match your search.</p>
					) : (
						filteredGroups.map((groupNode) => (
							<ExplorerPermissionGroup
								key={groupNode.group}
								groupNode={groupNode}
								groups={groups}
								isBranchOpen={isBranchOpen}
								onBranchOpenChange={handleBranchOpenChange}
								selectedId={selectedPermission?.id ?? null}
								onSelect={setSelectedPermission}
							/>
						))
					)}
				</TreeView>

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
