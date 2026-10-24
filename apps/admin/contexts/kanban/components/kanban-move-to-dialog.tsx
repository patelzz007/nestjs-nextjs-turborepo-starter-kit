"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { KANBAN_PARENT_TYPE, KANBAN_SEARCH_LIMIT, type KanbanItemRef, type KanbanItemType } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@workspace/ui/components/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Check, CircleSlash } from "lucide-react";
import * as React from "react";

import { KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import { useMoveToParent, type KanbanMoveSubject } from "../lib/use-move-to-parent";
import { KanbanLevelChip } from "./kanban-task-badges";

/** The levels whose parent is optional: they can be moved out from under one (a feature without an epic, a story without a feature). */
const PARENT_OPTIONAL: ReadonlySet<KanbanItemType> = new Set<KanbanItemType>(["FEATURE", "STORY"]);

/** The command list's value for "No parent" (never an item id). */
const NO_PARENT_VALUE = "no-parent";

/** The item Move to… moves: what the dialog names, and what the move sends. */
export interface KanbanMoveTarget extends KanbanMoveSubject {
	readonly key: string | null;
	readonly type: KanbanItemType;
	readonly title: string;
}

interface ParentOption {
	readonly ref: KanbanItemRef;
	/** The option's own parent chain, read top first (`EPIC-2 · Payments`). */
	readonly context: string | null;
}

/** The parents an item can move under: matches of the search (ranked by key, then title), or the level's items by title before anything is typed. */
function useParentOptions(parentType: KanbanItemType, text: string): { readonly options: readonly ParentOption[]; readonly isLoading: boolean } {
	const { api } = useAuth();
	const query = text.trim();
	const searched = api.kanban.search.useQuery({ q: query, type: parentType, limit: KANBAN_SEARCH_LIMIT }, { enabled: query.length > 0 });
	const browsed = api.kanban.items.useQuery({ page: 1, limit: KANBAN_SEARCH_LIMIT, filter: { type: { eq: parentType } } }, { enabled: query.length === 0 });
	const options = React.useMemo((): readonly ParentOption[] => {
		if (query.length > 0) {
			return (searched.data?.data.results ?? []).map((result) => ({
				ref: { id: result.id, key: result.key, type: result.type, title: result.title },
				context: result.ancestors.length === 0 ? null : result.ancestors.map((ancestor) => ancestor.key ?? ancestor.title).join(" › "),
			}));
		}
		return (browsed.data?.data ?? []).map((item) => ({ ref: { id: item.id, key: item.key, type: item.type, title: item.title }, context: null }));
	}, [browsed.data, query.length, searched.data]);
	return { options, isLoading: query.length > 0 ? searched.isFetching : browsed.isFetching };
}

interface MovePickerProps {
	readonly target: KanbanMoveTarget;
	readonly parentType: KanbanItemType;
	readonly onPicked: (parent: KanbanItemRef | null) => void;
	readonly isPending: boolean;
}

function MovePicker({ target, parentType, onPicked, isPending }: MovePickerProps): React.JSX.Element {
	const [text, setText] = React.useState("");
	const { options, isLoading } = useParentOptions(parentType, text);
	const parentDisplay = KANBAN_TYPE_DISPLAY[parentType];
	const handleSelect = React.useCallback(
		(value: string): void => {
			if (value === NO_PARENT_VALUE) {
				onPicked(null);
				return;
			}
			const picked = options.find((option) => option.ref.id === value);
			if (picked !== undefined && picked.ref.id !== target.parentId) {
				onPicked(picked.ref);
			}
		},
		[onPicked, options, target.parentId],
	);
	return (
		<Command shouldFilter={false} className="rounded-lg border">
			<CommandInput
				value={text}
				onValueChange={setText}
				placeholder={`Search ${parentDisplay.plural.toLowerCase()} by key or title`}
				aria-label={`Search ${parentDisplay.plural.toLowerCase()}`}
			/>
			<CommandList className="max-h-72">
				<CommandEmpty>{isLoading ? "Searching…" : `No ${parentDisplay.label.toLowerCase()} matches.`}</CommandEmpty>
				<CommandGroup heading={parentDisplay.plural}>
					{options.map((option) => {
						const isCurrent = option.ref.id === target.parentId;
						return (
							<CommandItem key={option.ref.id} value={option.ref.id} onSelect={handleSelect} disabled={isPending || isCurrent} className="gap-2">
								<KanbanLevelChip type={option.ref.type} itemKey={option.ref.key} />
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate">{option.ref.title}</span>
									{option.context === null ? null : <span className="truncate text-xs text-muted-foreground">{option.context}</span>}
								</span>
								{isCurrent ? (
									<span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
										<Check aria-hidden className="size-3.5" />
										Current
									</span>
								) : null}
							</CommandItem>
						);
					})}
				</CommandGroup>
				{PARENT_OPTIONAL.has(target.type) && target.parentId !== null && text.trim().length === 0 ? (
					<CommandGroup heading="Or">
						<CommandItem value={NO_PARENT_VALUE} onSelect={handleSelect} disabled={isPending} className="gap-2">
							<CircleSlash aria-hidden className="size-4 text-muted-foreground" />
							No {parentDisplay.label.toLowerCase()}
						</CommandItem>
					</CommandGroup>
				) : null}
			</CommandList>
		</Command>
	);
}

export interface KanbanMoveToDialogProps {
	/** The item being moved; `null` keeps the dialog closed. */
	readonly target: KanbanMoveTarget | null;
	readonly onClose: () => void;
	/** After a move landed, with the parent it went under (a board shows the new lane or narrows to it). */
	readonly onMoved?: ((parent: KanbanItemRef | null) => void) | undefined;
}

/**
 * Move to…: put an item under another parent one level up — a story under
 * another feature, a task under another story, a subtask under another task.
 * Only parents of that level are offered, searched by key or title. The item
 * keeps its column and place; a toast offers Undo (`useMoveToParent`).
 */
export function KanbanMoveToDialog({ target, onClose, onMoved }: KanbanMoveToDialogProps): React.JSX.Element {
	const { move, isPending } = useMoveToParent();
	const parentType = target === null ? null : KANBAN_PARENT_TYPE[target.type];
	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			if (!open) {
				onClose();
			}
		},
		[onClose],
	);
	const handlePicked = React.useCallback(
		(parent: KanbanItemRef | null): void => {
			if (target === null) {
				return;
			}
			void move(target, parent).then((moved): void => {
				if (moved !== null) {
					onClose();
					onMoved?.(parent);
				}
			});
		},
		[move, onClose, onMoved, target],
	);
	const parentLabel = parentType === null ? "parent" : KANBAN_TYPE_DISPLAY[parentType].label.toLowerCase();
	const isOpen = target !== null && parentType !== null;
	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex min-w-0 items-center gap-2">
						<span className="shrink-0">Move</span>
						{target === null ? null : <KanbanLevelChip type={target.type} itemKey={target.key} />}
						<span className="shrink-0">to…</span>
					</DialogTitle>
					<DialogDescription>
						Choose the {parentLabel} “{target?.title ?? ""}” belongs under. It keeps its column and place on the board.
					</DialogDescription>
				</DialogHeader>
				{target === null || parentType === null ? null : <MovePicker key={target.id} target={target} parentType={parentType} onPicked={handlePicked} isPending={isPending} />}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
