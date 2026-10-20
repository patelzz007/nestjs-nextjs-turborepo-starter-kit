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

/** A command at the foot of the menu ("Create new tenant", "Manage locations"). */
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

/**
 * A choice row. Hover is a soft wash (`highlight="soft"`), never the solid pill, so it can't be mistaken for
 * the selection. The current choice is the one tinted thing in the menu: a soft brand fill, and its check
 * in the brand colour, a little heavier.
 */
const SWITCHER_OPTION_CLASSES =
	"gap-3 rounded-md py-2 pe-9 data-checked:bg-primary/10 data-checked:data-highlighted:bg-primary/15 *:data-[slot=dropdown-menu-radio-item-indicator]:inset-e-3 *:data-[slot=dropdown-menu-radio-item-indicator]:text-primary *:data-[slot=dropdown-menu-radio-item-indicator]:[&_svg]:stroke-3";

/** A command row: quiet until pointed at, its icon in a dashed "add" tile that lines up with the choices' visuals. */
const SWITCHER_ACTION_CLASSES = "gap-3 rounded-md py-2 text-muted-foreground data-highlighted:text-foreground";

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
			{/* Sentence case, with how many choices the group holds — not a shouted eyebrow. */}
			<DropdownMenuLabel className="flex items-center justify-between gap-2 px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">
				<span>{group.label}</span>
				<span data-slot="panel-sidebar-switcher-count" className="rounded-full bg-foreground/8 px-1.5 text-xs leading-5 font-medium text-muted-foreground tabular-nums">
					{group.options.length}
				</span>
			</DropdownMenuLabel>
			<DropdownMenuRadioGroup value={group.value} onValueChange={handleValueChange} className="flex flex-col gap-0.5">
				{group.options.map((option: PanelSidebarSwitcherOption): React.JSX.Element => (
					<DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick highlight="soft" className={SWITCHER_OPTION_CLASSES}>
						{option.visual === undefined ? null : <span className="flex shrink-0 items-center">{option.visual}</span>}
						<span className="flex min-w-0 flex-col">
							<span className="truncate font-medium text-foreground">{option.label}</span>
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
 * names the current workspace (store, tenant, team) and opens a menu to
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
				<DropdownMenuContent side="bottom" align="start" sideOffset={6} className="w-(--anchor-width) min-w-64 p-1.5">
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
								<DropdownMenuItem key={action.id} onClick={action.onSelect} highlight="soft" className={SWITCHER_ACTION_CLASSES}>
									<span
										data-slot="panel-sidebar-switcher-action-icon"
										className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors group-data-highlighted/dropdown-menu-item:border-primary/40 group-data-highlighted/dropdown-menu-item:text-primary">
										{action.icon}
									</span>
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
