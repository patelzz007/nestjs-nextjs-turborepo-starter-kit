"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import * as React from "react";

import type { AdminSidebarLabels } from "@/lib/sidebar-labels";

export interface SidebarWorkspace {
	readonly id: string;
	readonly name: string;
}

export interface SidebarWorkspaceSwitcherProps {
	readonly workspaces: readonly SidebarWorkspace[];
	readonly activeWorkspaceId: string;
	readonly onWorkspaceChange: (workspaceId: string) => void;
	readonly labels: AdminSidebarLabels;
}

/** Dumb workspace picker — parent supplies tenants when multi-tenant lands. */
export function SidebarWorkspaceSwitcher({ workspaces, activeWorkspaceId, onWorkspaceChange, labels }: SidebarWorkspaceSwitcherProps): React.JSX.Element | null {
	const handleValueChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				onWorkspaceChange(value);
			}
		},
		[onWorkspaceChange],
	);

	if (workspaces.length <= 1) {
		const single = workspaces[0];
		if (single === undefined) {
			return null;
		}
		return <span className="truncate text-[length:var(--text-sidebar-caption)] text-muted-foreground">{single.name}</span>;
	}

	return (
		<Select value={activeWorkspaceId} onValueChange={handleValueChange}>
			<SelectTrigger aria-label={labels.workspaceSwitcherAriaLabel} className="h-7 w-full border-sidebar-border bg-sidebar-accent/20 text-xs shadow-none">
				<SelectValue placeholder={labels.workspaceSwitcherPlaceholder} />
			</SelectTrigger>
			<SelectContent>
				{workspaces.map((workspace) => (
					<SelectItem key={workspace.id} value={workspace.id}>
						{workspace.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
