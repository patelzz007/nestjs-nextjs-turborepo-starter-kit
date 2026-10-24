"use client";

import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { PERMISSION, type KanbanSearchResult } from "@workspace/shared";
import { CommandGroup, CommandItem } from "@workspace/ui/components/command";
import * as React from "react";

import type { FocusAction, FocusActions } from "@/lib/palette/focus-actions";

import { KanbanLevelChip, KanbanStatusBadge } from "./kanban-task-badges";

/** Items the palette lists for one search: enough to find the one meant, never a board. */
export const KANBAN_PALETTE_RESULT_LIMIT = 8;
/** The shortest text the palette searches items for (one letter would match half the board). */
export const KANBAN_PALETTE_MIN_QUERY_LENGTH = 2;

/** The palette's item matches for `query`, ranked by the API (exact key, key prefix, title); none without LIST on KANBAN_TASK. */
export function useKanbanPaletteSearch(query: string): readonly KanbanSearchResult[] {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const text = query.trim();
	const enabled = can(PERMISSION.KANBAN_TASK.LIST) && text.length >= KANBAN_PALETTE_MIN_QUERY_LENGTH;
	const search = api.kanban.search.useQuery({ q: text, limit: KANBAN_PALETTE_RESULT_LIMIT }, { enabled });
	return enabled ? (search.data?.data.results ?? []) : [];
}

function ItemResult({ result, onOpen }: { readonly result: KanbanSearchResult; readonly onOpen: (itemId: string) => void }): React.JSX.Element {
	const handleSelect = React.useCallback((): void => {
		onOpen(result.id);
	}, [onOpen, result.id]);
	const path = result.ancestors.map((ancestor) => ancestor.key ?? ancestor.title).join(" › ");
	return (
		<CommandItem value={`kanban-item:${result.id}`} onSelect={handleSelect} className="gap-2">
			<KanbanLevelChip type={result.type} itemKey={result.key} />
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate">{result.title}</span>
				{path.length === 0 ? null : <span className="truncate text-xs text-muted-foreground">{path}</span>}
			</span>
			<KanbanStatusBadge column={result.column} size="sm" />
		</CommandItem>
	);
}

function FocusActionItem({ action, onRun }: { readonly action: FocusAction; readonly onRun: (action: FocusAction) => void }): React.JSX.Element {
	const handleSelect = React.useCallback((): void => {
		onRun(action);
	}, [action, onRun]);
	const Icon = action.icon;
	return (
		<CommandItem value={`focus-action:${action.id}`} onSelect={handleSelect} className="gap-2">
			<Icon aria-hidden className="size-4 text-muted-foreground" />
			{action.label}
		</CommandItem>
	);
}

export interface KanbanPaletteResultsProps {
	readonly focus: FocusActions | null;
	readonly actions: readonly FocusAction[];
	readonly items: readonly KanbanSearchResult[];
	readonly onRunAction: (action: FocusAction) => void;
	readonly onOpenItem: (itemId: string) => void;
}

/**
 * The palette's own groups for the kanban boards: the actions for the item on
 * screen ("Actions for STORY-142": Move to…, Change status…, Edit) and the
 * items the search finds, each named by its level chip and key, with its parent
 * chain and status.
 */
export function KanbanPaletteResults({ focus, actions, items, onRunAction, onOpenItem }: KanbanPaletteResultsProps): React.JSX.Element | null {
	if (actions.length === 0 && items.length === 0) {
		return null;
	}
	return (
		<>
			{focus === null || actions.length === 0 ? null : (
				<CommandGroup heading={`Actions for ${focus.heading}`}>
					{actions.map((action) => (
						<FocusActionItem key={action.id} action={action} onRun={onRunAction} />
					))}
				</CommandGroup>
			)}
			{items.length === 0 ? null : (
				<CommandGroup heading="Items">
					{items.map((result) => (
						<ItemResult key={result.id} result={result} onOpen={onOpenItem} />
					))}
				</CommandGroup>
			)}
		</>
	);
}
