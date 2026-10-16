"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronsUpDown } from "lucide-react";
import * as React from "react";

/** One choice in a switcher group: a workspace, store, location… */
export interface PanelSidebarSwitcherOption {
	readonly value: string;
	readonly label: string;
	/** A second line under the label (a plan, a full name, an address). */
	readonly description?: string | undefined;
	/** A small leading visual: an avatar, a monogram, an icon. */
	readonly visual?: React.ReactNode;
}

/** A labelled set of choices with one selected — e.g. "Stores" or "Locations". */
export interface PanelSidebarSwitcherGroup {
	readonly id: string;
	readonly label: string;
	readonly options: readonly PanelSidebarSwitcherOption[];
	/** The selected option's `value`. */
	readonly value: string;
	readonly onValueChange: (value: string) => void;
}

/** A command at the foot of the menu ("Create new organization", "Manage locations"). */
export interface PanelSidebarSwitcherAction {
	readonly id: string;
	readonly label: string;
	readonly icon?: React.ReactNode;
	readonly onSelect: () => void;
}

export interface PanelSidebarSwitcherProps {
	/** What the trigger shows: the current context's name… */
	readonly title: string;
	/** …a second line (the current sub-context, e.g. the active location)… */
	readonly subtitle?: string | undefined;
	/** …and its visual (an avatar or monogram, `size-9` like the brand tile it replaces). */
	readonly visual: React.ReactNode;
	/** The trigger's accessible name — what the menu switches ("Switch store or location"). */
	readonly triggerLabel: string;
	readonly groups: readonly PanelSidebarSwitcherGroup[];
	readonly actions?: readonly PanelSidebarSwitcherAction[];
	/** The collapse toggle at the end of the header, as `PanelSidebarHeader` has it. Default on. */
	readonly showCollapseToggle?: boolean;
	readonly className?: string;
}

const NO_ACTIONS: readonly PanelSidebarSwitcherAction[] = [];

interface SwitcherGroupProps {
	readonly group: PanelSidebarSwitcherGroup;
}

/** One group: its label, then its options as radio items (the selected one carries the check). Choosing one closes the menu, as a switch should. */
function SwitcherGroup({ group }: SwitcherGroupProps): React.JSX.Element {
	const { onValueChange } = group;
	const handleValueChange = React.useCallback(
		(value: string): void => {
			onValueChange(value);
		},
		[onValueChange],
	);
	return (
		<DropdownMenuGroup>
			<DropdownMenuLabel className="px-2 pt-1.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</DropdownMenuLabel>
			<DropdownMenuRadioGroup value={group.value} onValueChange={handleValueChange}>
				{group.options.map((option: PanelSidebarSwitcherOption): React.JSX.Element => (
					<DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick className="gap-2.5 py-1.5 pe-8">
						{option.visual === undefined ? null : <span className="flex shrink-0 items-center">{option.visual}</span>}
						<span className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{option.label}</span>
							{option.description === undefined ? null : <span className="truncate text-xs text-muted-foreground">{option.description}</span>}
						</span>
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
		</DropdownMenuGroup>
	);
}

/**
 * The panel sidebar's context switcher (app shell 3) — the header row that
 * names the current workspace (store, organization, team) and opens a menu to
 * change it: labelled groups of choices with the current one checked, then
 * commands such as "Create new …". It takes the place of `PanelSidebarHeader`
 * and keeps its collapse toggle. Stateless and controlled: each group's
 * `value` and `onValueChange` belong to the caller. The ref reaches the
 * header `<div>`.
 */
export const PanelSidebarSwitcher = React.forwardRef<HTMLDivElement, PanelSidebarSwitcherProps>(function PanelSidebarSwitcher(
	{ title, subtitle, visual, triggerLabel, groups, actions = NO_ACTIONS, showCollapseToggle = true, className },
	ref,
): React.JSX.Element {
	const visibleGroups = groups.filter((group: PanelSidebarSwitcherGroup): boolean => group.options.length > 0);
	return (
		<div ref={ref} data-slot="panel-sidebar-switcher" className={cn("panel-shell-sidebar-header flex h-14 shrink-0 items-center gap-1 px-2", className)}>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<button
							type="button"
							className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 text-start transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-popup-open:bg-sidebar-accent"
						/>
					}
					aria-label={`${triggerLabel}: ${subtitle === undefined ? title : `${title}, ${subtitle}`}`}>
					<span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">{visual}</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate text-sm font-semibold text-sidebar-foreground" title={title}>
							{title}
						</span>
						{subtitle === undefined ? null : (
							<span className="block truncate text-xs text-muted-foreground" title={subtitle}>
								{subtitle}
							</span>
						)}
					</span>
					<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent side="bottom" align="start" sideOffset={6} className="w-(--anchor-width) min-w-64">
					{visibleGroups.map((group: PanelSidebarSwitcherGroup, index: number): React.JSX.Element => (
						<React.Fragment key={group.id}>
							{index > 0 ? <DropdownMenuSeparator /> : null}
							<SwitcherGroup group={group} />
						</React.Fragment>
					))}
					{actions.length > 0 ? (
						<>
							{visibleGroups.length > 0 ? <DropdownMenuSeparator /> : null}
							{actions.map((action: PanelSidebarSwitcherAction): React.JSX.Element => (
								<DropdownMenuItem key={action.id} onClick={action.onSelect} className="gap-2.5 text-muted-foreground">
									{action.icon}
									{action.label}
								</DropdownMenuItem>
							))}
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
			{showCollapseToggle ? <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-sidebar-foreground" /> : null}
		</div>
	);
});
