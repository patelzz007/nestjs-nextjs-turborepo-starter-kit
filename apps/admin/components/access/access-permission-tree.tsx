"use client";

import { isRedundantResourceLabel } from "@/lib/permission-label-utils";
import type { PermissionTreeGroupNode, PermissionTreeLeaf, PermissionTreeResourceNode } from "@/lib/build-permission-tree";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Label } from "@workspace/ui/components/form/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/navigation/collapsible";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronRight, FolderTree, Layers3 } from "lucide-react";
import * as React from "react";

import { USER_DETAIL_PAGE_BUTTON_CLASS } from "../users/user-detail-button";

export interface AccessPermissionTreeProps {
	readonly groups: readonly PermissionTreeGroupNode[];
	readonly emptyMessage?: string;
	readonly defaultOpen?: boolean;
	readonly selectable?: boolean;
	readonly selectedPermissionIds?: ReadonlySet<string>;
	readonly inheritedPermissionIds?: ReadonlySet<string>;
	readonly onTogglePermission?: (permissionId: string, selected: boolean) => void;
	readonly toggleDisabled?: boolean;
	readonly onRemovePermission?: (permissionId: string) => void;
	readonly removeDisabled?: boolean;
}

type PermissionTreeDisplay =
	{ readonly kind: "flat"; readonly permissions: readonly PermissionTreeLeaf[] } | { readonly kind: "nested"; readonly resources: readonly PermissionTreeResourceNode[] };

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

function countSelectedInGroup(groupNode: PermissionTreeGroupNode, selectedPermissionIds: ReadonlySet<string> | undefined): number {
	if (selectedPermissionIds === undefined) {
		return 0;
	}
	let count = 0;
	for (const resourceNode of groupNode.resources) {
		for (const permission of resourceNode.permissions) {
			if (selectedPermissionIds.has(permission.id)) {
				count += 1;
			}
		}
	}
	return count;
}

interface AccessPermissionTreeLeafProps {
	readonly permissionId: string;
	readonly label: string;
	readonly description?: string | null;
	readonly selectable?: boolean;
	readonly selected?: boolean;
	readonly inherited?: boolean;
	readonly onTogglePermission?: (permissionId: string, selected: boolean) => void;
	readonly toggleDisabled?: boolean;
	readonly onRemovePermission?: (permissionId: string) => void;
	readonly removeDisabled?: boolean;
}

const AccessPermissionTreeLeaf = React.forwardRef<HTMLDivElement, AccessPermissionTreeLeafProps>(function AccessPermissionTreeLeaf(
	{
		permissionId,
		label,
		description,
		selectable = false,
		selected = false,
		inherited = false,
		onTogglePermission,
		toggleDisabled = false,
		onRemovePermission,
		removeDisabled = false,
	},
	ref,
): React.JSX.Element {
	const inputId = `permission-${permissionId}`;

	const handleRemoveClick = React.useCallback((): void => {
		if (onRemovePermission !== undefined) {
			onRemovePermission(permissionId);
		}
	}, [onRemovePermission, permissionId]);

	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			if (onTogglePermission !== undefined) {
				onTogglePermission(permissionId, checked);
			}
		},
		[onTogglePermission, permissionId],
	);

	return (
		<div
			ref={ref}
			role="treeitem"
			aria-selected={selectable ? selected : undefined}
			className={cn(
				"flex items-start gap-3 rounded-md border px-3 py-3 transition-colors",
				selectable && selected ? "border-primary/30 bg-primary/5" : "border-border/70 bg-background",
			)}>
			{selectable ? <Checkbox id={inputId} checked={selected} disabled={toggleDisabled} onCheckedChange={handleCheckedChange} className="mt-0.5 shrink-0" /> : null}
			<div className="min-w-0 flex-1 space-y-1.5">
				<div className="flex flex-wrap items-center gap-2">
					{selectable ? (
						<Label htmlFor={inputId} className="cursor-pointer font-mono text-xs tracking-wide text-foreground">
							{label}
						</Label>
					) : (
						<Badge variant="outline" className="font-mono text-[11px] tracking-wide">
							{label}
						</Badge>
					)}
					{inherited && !selected ? (
						<Badge variant="secondary" className="text-[10px]">
							Via role
						</Badge>
					) : null}
				</div>
				{description !== undefined && description !== null && description.length > 0 ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
			</div>
			{!selectable && onRemovePermission !== undefined ? (
				<Button type="button" size="sm" className={cn("h-8 shrink-0 px-3", USER_DETAIL_PAGE_BUTTON_CLASS)} disabled={removeDisabled} onClick={handleRemoveClick}>
					Remove
				</Button>
			) : null}
		</div>
	);
});

interface AccessPermissionTreeLeafListProps {
	readonly permissions: readonly PermissionTreeLeaf[];
	readonly selectable?: boolean;
	readonly selectedPermissionIds?: ReadonlySet<string>;
	readonly inheritedPermissionIds?: ReadonlySet<string>;
	readonly onTogglePermission?: (permissionId: string, selected: boolean) => void;
	readonly toggleDisabled?: boolean;
	readonly onRemovePermission?: (permissionId: string) => void;
	readonly removeDisabled?: boolean;
}

function AccessPermissionTreeLeafList({
	permissions,
	selectable = false,
	selectedPermissionIds,
	inheritedPermissionIds,
	onTogglePermission,
	toggleDisabled = false,
	onRemovePermission,
	removeDisabled = false,
}: AccessPermissionTreeLeafListProps): React.JSX.Element {
	return (
		<div className={cn("grid gap-2", selectable ? "grid-cols-1" : "sm:grid-cols-2")}>
			{permissions.map((permission) => (
				<AccessPermissionTreeLeaf
					key={permission.id}
					permissionId={permission.id}
					label={permission.action}
					description={permission.description}
					selectable={selectable}
					selected={selectedPermissionIds?.has(permission.id) ?? false}
					inherited={inheritedPermissionIds?.has(permission.id) ?? false}
					onTogglePermission={onTogglePermission}
					toggleDisabled={toggleDisabled}
					onRemovePermission={onRemovePermission}
					removeDisabled={removeDisabled}
				/>
			))}
		</div>
	);
}

interface AccessPermissionTreeResourceProps {
	readonly resourceNode: PermissionTreeResourceNode;
	readonly defaultOpen?: boolean;
	readonly selectable?: boolean;
	readonly selectedPermissionIds?: ReadonlySet<string>;
	readonly inheritedPermissionIds?: ReadonlySet<string>;
	readonly onTogglePermission?: (permissionId: string, selected: boolean) => void;
	readonly toggleDisabled?: boolean;
	readonly onRemovePermission?: (permissionId: string) => void;
	readonly removeDisabled?: boolean;
}

function AccessPermissionTreeResource({
	resourceNode,
	defaultOpen = false,
	selectable = false,
	selectedPermissionIds,
	inheritedPermissionIds,
	onTogglePermission,
	toggleDisabled = false,
	onRemovePermission,
	removeDisabled = false,
}: AccessPermissionTreeResourceProps): React.JSX.Element {
	const [open, setOpen] = React.useState(defaultOpen);
	const selectedCount: number = resourceNode.permissions.filter((permission) => selectedPermissionIds?.has(permission.id) ?? false).length;

	return (
		<div role="treeitem" aria-expanded={open} className="overflow-hidden rounded-md border border-border/70 bg-background">
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/40 [&[data-panel-open]]:bg-muted/20">
					<ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-90" : "")} />
					<Layers3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{resourceNode.resource}</span>
					<Badge variant="secondary" className="shrink-0">
						{selectable && selectedCount > 0 ? `${String(selectedCount)}/${String(resourceNode.permissions.length)}` : String(resourceNode.permissions.length)}
					</Badge>
				</CollapsibleTrigger>
				<CollapsibleContent className="space-y-2 border-t border-border/60 bg-muted/10 px-3 py-3">
					<AccessPermissionTreeLeafList
						permissions={resourceNode.permissions}
						selectable={selectable}
						selectedPermissionIds={selectedPermissionIds}
						inheritedPermissionIds={inheritedPermissionIds}
						onTogglePermission={onTogglePermission}
						toggleDisabled={toggleDisabled}
						onRemovePermission={onRemovePermission}
						removeDisabled={removeDisabled}
					/>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

interface AccessPermissionTreeGroupProps {
	readonly groupNode: PermissionTreeGroupNode;
	readonly defaultOpen?: boolean;
	readonly selectable?: boolean;
	readonly selectedPermissionIds?: ReadonlySet<string>;
	readonly inheritedPermissionIds?: ReadonlySet<string>;
	readonly onTogglePermission?: (permissionId: string, selected: boolean) => void;
	readonly toggleDisabled?: boolean;
	readonly onRemovePermission?: (permissionId: string) => void;
	readonly removeDisabled?: boolean;
}

function AccessPermissionTreeGroup({
	groupNode,
	defaultOpen = false,
	selectable = false,
	selectedPermissionIds,
	inheritedPermissionIds,
	onTogglePermission,
	toggleDisabled = false,
	onRemovePermission,
	removeDisabled = false,
}: AccessPermissionTreeGroupProps): React.JSX.Element {
	const [open, setOpen] = React.useState(defaultOpen);
	const display: PermissionTreeDisplay = resolveGroupDisplay(groupNode);
	const permissionCount: number = groupNode.resources.reduce((total, resourceNode) => total + resourceNode.permissions.length, 0);
	const selectedCount: number = countSelectedInGroup(groupNode, selectedPermissionIds);

	return (
		<div role="treeitem" aria-expanded={open} className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 [&[data-panel-open]]:bg-muted/20">
					<ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-90" : "")} />
					<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
						<FolderTree className="size-4" aria-hidden="true" />
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-semibold text-foreground">{groupNode.group}</p>
						<p className="text-xs text-muted-foreground">
							{selectable && selectedCount > 0
								? `${String(selectedCount)} of ${String(permissionCount)} granted directly`
								: `${String(permissionCount)} permission${permissionCount === 1 ? "" : "s"}`}
						</p>
					</div>
					<Badge variant={selectable && selectedCount > 0 ? "default" : "secondary"} className="shrink-0">
						{selectable && selectedCount > 0 ? `${String(selectedCount)}/${String(permissionCount)}` : String(permissionCount)}
					</Badge>
				</CollapsibleTrigger>
				<CollapsibleContent className="space-y-3 border-t border-border/70 bg-muted/10 px-4 py-4">
					{display.kind === "flat" ? (
						<AccessPermissionTreeLeafList
							permissions={display.permissions}
							selectable={selectable}
							selectedPermissionIds={selectedPermissionIds}
							inheritedPermissionIds={inheritedPermissionIds}
							onTogglePermission={onTogglePermission}
							toggleDisabled={toggleDisabled}
							onRemovePermission={onRemovePermission}
							removeDisabled={removeDisabled}
						/>
					) : (
						display.resources.map((resourceNode) => (
							<AccessPermissionTreeResource
								key={`${groupNode.group}-${resourceNode.resource}`}
								resourceNode={resourceNode}
								defaultOpen={defaultOpen}
								selectable={selectable}
								selectedPermissionIds={selectedPermissionIds}
								inheritedPermissionIds={inheritedPermissionIds}
								onTogglePermission={onTogglePermission}
								toggleDisabled={toggleDisabled}
								onRemovePermission={onRemovePermission}
								removeDisabled={removeDisabled}
							/>
						))
					)}
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

/**
 * Nested group → resource → action tree for permission lists on the user detail page.
 */
export const AccessPermissionTree = React.forwardRef<HTMLDivElement, AccessPermissionTreeProps>(function AccessPermissionTree(
	{
		groups,
		emptyMessage = "No permissions.",
		defaultOpen = false,
		selectable = false,
		selectedPermissionIds,
		inheritedPermissionIds,
		onTogglePermission,
		toggleDisabled = false,
		onRemovePermission,
		removeDisabled = false,
	},
	ref,
): React.JSX.Element {
	if (groups.length === 0) {
		return (
			<p ref={ref} className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
				{emptyMessage}
			</p>
		);
	}

	return (
		<div ref={ref} role="tree" aria-label={selectable ? "Direct permission grants" : "Permission hierarchy"} className="space-y-4">
			{groups.map((groupNode) => (
				<AccessPermissionTreeGroup
					key={groupNode.group}
					groupNode={groupNode}
					defaultOpen={defaultOpen}
					selectable={selectable}
					selectedPermissionIds={selectedPermissionIds}
					inheritedPermissionIds={inheritedPermissionIds}
					onTogglePermission={onTogglePermission}
					toggleDisabled={toggleDisabled}
					onRemovePermission={onRemovePermission}
					removeDisabled={removeDisabled}
				/>
			))}
		</div>
	);
});
