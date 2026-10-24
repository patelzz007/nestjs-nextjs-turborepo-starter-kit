import { kanbanColumnIsDone, type KanbanColumnStatus, type KanbanItemType, type KanbanTaskPriority, type KanbanTeam } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/core/utils";
import { Ban, Tag } from "lucide-react";
import * as React from "react";

import {
	columnStatusLabel,
	KANBAN_LEVEL_CHIP_CLASS,
	KANBAN_PRIORITY_DISPLAY,
	KANBAN_PRIORITY_ICON_CLASS,
	KANBAN_TEAM_DISPLAY,
	KANBAN_TYPE_DISPLAY,
	KANBAN_TYPE_ICON_CLASS,
	pointsLabel,
} from "../lib/kanban-display";

/** An item's level as a small filled tile with its icon, named for screen readers (a card, a tree row). */
export function KanbanTypeIcon({ type, size = "sm" }: { readonly type: KanbanItemType; readonly size?: "sm" | "lg" }): React.JSX.Element {
	const display = KANBAN_TYPE_DISPLAY[type];
	const Icon = display.icon;
	return (
		<span
			role="img"
			aria-label={display.label}
			title={display.label}
			className={cn("inline-flex shrink-0 items-center justify-center", KANBAN_TYPE_ICON_CLASS[type], size === "sm" ? "size-4.5 rounded-[0.3rem]" : "size-11 rounded-lg")}>
			<Icon aria-hidden className={size === "sm" ? "size-3" : "size-6"} />
		</span>
	);
}

/**
 * What an item is, at a glance — `[icon] STORY STORY-142` — the first thing on
 * a card, a breadcrumb, a search result and a rollup row: the level's icon tile,
 * its name in capitals in the level's tone, and the item's key in muted
 * monospace (left out until the item has one). One line, never wrapping; the
 * key is selectable text, so it can be copied.
 */
export function KanbanLevelChip({
	type,
	itemKey,
	showIcon = true,
}: {
	readonly type: KanbanItemType;
	readonly itemKey: string | null;
	readonly showIcon?: boolean;
}): React.JSX.Element {
	const display = KANBAN_TYPE_DISPLAY[type];
	return (
		<span className="inline-flex max-w-full min-w-0 shrink-0 items-center gap-1.5 whitespace-nowrap">
			{showIcon ? <KanbanTypeIcon type={type} /> : null}
			<span className={cn("rounded-[0.25rem] px-1 py-px text-[0.6875rem] leading-4 font-semibold tracking-wide uppercase", KANBAN_LEVEL_CHIP_CLASS[type])}>
				{display.label}
			</span>
			{itemKey === null ? null : <span className="truncate font-mono text-[0.6875rem] leading-4 text-muted-foreground tabular-nums">{itemKey}</span>}
		</span>
	);
}

/** An item's priority as its bare toned icon, named for screen readers. */
export function KanbanPriorityIcon({ priority }: { readonly priority: KanbanTaskPriority }): React.JSX.Element {
	const display = KANBAN_PRIORITY_DISPLAY[priority];
	const Icon = display.icon;
	return (
		<span role="img" aria-label={`${display.label} priority`} title={`${display.label} priority`} className={cn("inline-flex shrink-0", KANBAN_PRIORITY_ICON_CLASS[priority])}>
			<Icon aria-hidden className="size-4" />
		</span>
	);
}

/** A story's estimate (or an epic's / feature's rolled-up total) as a small grey pill. */
export function KanbanPointsPill({ points }: { readonly points: number }): React.JSX.Element {
	return (
		<span
			title="Story points"
			className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
			<span className="sr-only">Story points:</span>
			{points}
		</span>
	);
}

/** A task's priority as the card shows it: its icon and label in its badge. */
export function KanbanPriorityBadge({ priority }: { readonly priority: KanbanTaskPriority }): React.JSX.Element {
	const display = KANBAN_PRIORITY_DISPLAY[priority];
	const Icon = display.icon;
	return (
		<Badge variant={display.variant} className="shrink-0 rounded-md px-2 font-medium">
			<Icon data-icon="inline-start" aria-hidden />
			{display.label}
		</Badge>
	);
}

/** A task's team in its tone. */
export function KanbanTeamBadge({ team }: { readonly team: KanbanTeam }): React.JSX.Element {
	const display = KANBAN_TEAM_DISPLAY[team];
	return (
		<Badge variant={display.tone} className="rounded-md px-2 font-medium">
			{display.label}
		</Badge>
	);
}

/** An item's level: its icon and name in its tone. */
export function KanbanTypeBadge({ type }: { readonly type: KanbanItemType }): React.JSX.Element {
	const display = KANBAN_TYPE_DISPLAY[type];
	const Icon = display.icon;
	return (
		<Badge variant={display.tone} className="shrink-0 rounded-md px-1.5 font-medium">
			<Icon data-icon="inline-start" aria-hidden />
			{display.label}
		</Badge>
	);
}

/** A story's estimate, or an epic's / feature's rolled-up points (`done` of `total`). */
export function KanbanPointsBadge({ points, done }: { readonly points: number; readonly done?: number | undefined }): React.JSX.Element {
	return (
		<Badge variant="outline" className="shrink-0 rounded-md px-1.5 font-medium tabular-nums" title={done === undefined ? "Story points" : "Story points done of the total"}>
			{done === undefined ? pointsLabel(points) : `${String(done)}/${pointsLabel(points)}`}
		</Badge>
	);
}

/** "Blocked": another item that is not done yet blocks this one. */
export function KanbanBlockedBadge(): React.JSX.Element {
	return (
		<Badge variant="destructive-light" className="shrink-0 rounded-md px-1.5 font-medium">
			<Ban data-icon="inline-start" aria-hidden />
			Blocked
		</Badge>
	);
}

/** An item's labels as outline chips, the first `max` of them and a "+n" for the rest. */
export function KanbanLabelChips({ labels, max }: { readonly labels: readonly string[]; readonly max?: number | undefined }): React.JSX.Element | null {
	if (labels.length === 0) {
		return null;
	}
	const shown = max === undefined ? labels : labels.slice(0, max);
	const hidden = labels.length - shown.length;
	return (
		<span className="flex min-w-0 flex-wrap items-center gap-1">
			{shown.map((label) => (
				<Badge key={label} variant="outline" className="rounded-md px-1.5 font-normal text-muted-foreground">
					<Tag data-icon="inline-start" aria-hidden />
					{label}
				</Badge>
			))}
			{hidden > 0 ? <span className="text-xs text-muted-foreground tabular-nums">+{hidden}</span> : null}
		</span>
	);
}

/** The columns that read as a state: done (or delivered), in review, in progress or planned; anything else is waiting. */
function statusVariant(column: KanbanColumnStatus): "success-light" | "info-light" | "primary-light" | "outline" {
	if (kanbanColumnIsDone(column)) {
		return "success-light";
	}
	if (column.board === "PLANNING") {
		return column.stage === "PLANNED" ? "primary-light" : "outline";
	}
	switch (column.state) {
		case "REVIEW":
			return "info-light";
		case "IN_PROGRESS":
			return "primary-light";
		case "TODO":
		case "DONE":
			return "outline";
	}
}

/** A column as a status badge: its title, toned by its stage or state. */
export type KanbanStatusColumn = KanbanColumnStatus & { readonly title: string };

/** The item's column as a state badge. */
export function KanbanStatusBadge({ column, size }: { readonly column: KanbanStatusColumn; readonly size?: "sm" | undefined }): React.JSX.Element {
	return (
		<Badge variant={statusVariant(column)} size={size} className="shrink-0 rounded-md px-1.5 font-medium whitespace-nowrap" title={columnStatusLabel(column)}>
			{column.title}
		</Badge>
	);
}
