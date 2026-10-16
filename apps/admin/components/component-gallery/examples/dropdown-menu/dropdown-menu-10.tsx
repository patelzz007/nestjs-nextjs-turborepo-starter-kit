"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { BuildingIcon, CheckIcon, ChevronsUpDownIcon, PaletteIcon, PlusIcon, SettingsIcon, type LucideIcon } from "lucide-react";
import * as React from "react";

/** A workspace shows an icon, or a person's photo when it is a personal one. */
interface Workspace {
	readonly id: string;
	readonly name: string;
	readonly plan: string;
	readonly icon?: LucideIcon;
	readonly avatarUrl?: string;
	readonly initials?: string;
}

const WORKSPACES: readonly Workspace[] = [
	{ id: "acme", name: "Acme Inc.", plan: "Enterprise", icon: BuildingIcon },
	{ id: "design", name: "Design Studio", plan: "Pro", icon: PaletteIcon },
	{
		id: "alex",
		name: "Alex Wong",
		plan: "Team",
		avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		initials: "AW",
	},
];

const INITIAL_WORKSPACE_ID = "design";
const TRIGGER = <Button variant="outline" className="w-52" />;

function WorkspaceMark({ workspace }: { readonly workspace: Workspace }): React.JSX.Element | null {
	if (workspace.avatarUrl !== undefined) {
		return (
			<Avatar className="size-4">
				<AvatarImage src={workspace.avatarUrl} alt="" />
				<AvatarFallback>{workspace.initials}</AvatarFallback>
			</Avatar>
		);
	}
	const Icon = workspace.icon;
	return Icon === undefined ? null : <Icon className="size-4" aria-hidden="true" />;
}

interface WorkspaceItemProps {
	readonly workspace: Workspace;
	readonly active: boolean;
	readonly onChoose: (id: string) => void;
}

function WorkspaceItem({ workspace, active, onChoose }: WorkspaceItemProps): React.JSX.Element {
	const choose = React.useCallback((): void => {
		onChoose(workspace.id);
	}, [onChoose, workspace.id]);
	return (
		<DropdownMenuItem className="gap-3" onClick={choose}>
			<WorkspaceMark workspace={workspace} />
			<div className="flex flex-1 flex-col">
				<span className="text-sm font-medium">{workspace.name}</span>
				<span className="text-xs text-muted-foreground">{workspace.plan}</span>
			</div>
			{active ? <CheckIcon className="size-4 text-primary" aria-hidden="true" /> : null}
		</DropdownMenuItem>
	);
}

export function DropdownMenu10Example(): React.JSX.Element {
	const [activeWorkspaceId, setActiveWorkspaceId] = React.useState(INITIAL_WORKSPACE_ID);
	const [fallback] = WORKSPACES;
	const activeWorkspace = WORKSPACES.find((workspace) => workspace.id === activeWorkspaceId) ?? fallback;

	return (
		<div className="flex items-center justify-center">
			<DropdownMenu>
				<DropdownMenuTrigger render={TRIGGER}>
					{activeWorkspace === undefined ? null : (
						<div className="flex items-center gap-1.5">
							<WorkspaceMark workspace={activeWorkspace} />
							<span className="text-sm font-medium">{activeWorkspace.name}</span>
						</div>
					)}
					<ChevronsUpDownIcon className="ms-auto size-3.5 opacity-60" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-56" align="start" sideOffset={8}>
					<DropdownMenuGroup>
						<DropdownMenuLabel>Workspaces</DropdownMenuLabel>
						{WORKSPACES.map((workspace): React.JSX.Element => (
							<WorkspaceItem key={workspace.id} workspace={workspace} active={workspace.id === activeWorkspaceId} onChoose={setActiveWorkspaceId} />
						))}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem>
							<PlusIcon aria-hidden="true" />
							Create workspace
						</DropdownMenuItem>
						<DropdownMenuItem>
							<SettingsIcon aria-hidden="true" />
							Manage workspaces
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
