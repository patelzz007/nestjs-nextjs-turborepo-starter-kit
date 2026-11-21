"use client";

// The actions at the end of each row: the inline buttons, then the ⋯ menu with the rest. An action whose `onSelect`
// returns a promise shows a spinner until it settles; one that rejects is replaced by a retry button until it
// succeeds. Presses inside never reach the row's own click.

import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatDataTableLabel, resolveDataTableRowActionTone, type DataTableLabels, type DataTableRowActionTone } from "@workspace/ui-kit-logic";
import type { RowData } from "@tanstack/react-table";
import { CircleAlert, MoreHorizontal } from "lucide-react";
import * as React from "react";

import type { DataTableRowAction } from "./props";
import { DESTRUCTIVE_OUTLINE_CLASS_NAME, memoGeneric } from "./shared";

/** Where one row's actions stand: which one is running, and which failed last. Keys are action keys. */
export interface RowActionRunState {
	readonly pendingKey: string | null;
	readonly failedKey: string | null;
}

const IDLE: RowActionRunState = { pendingKey: null, failedKey: null };

/**
 * Runs one action for a row and reports where it stands. A plain (non-promise) result finishes at once and leaves no
 * state behind; a promise is pending until it settles, and a rejection marks the action failed.
 */
export async function runRowAction<TData>(action: DataTableRowAction<TData>, row: TData, report: (state: RowActionRunState) => void): Promise<void> {
	const result = action.onSelect(row);
	if (!(result instanceof Promise)) {
		report(IDLE);
		return;
	}
	report({ pendingKey: action.key, failedKey: null });
	try {
		await result;
		report(IDLE);
	} catch {
		report({ pendingKey: null, failedKey: action.key });
	}
}

/** The actions one row offers: those without `isAvailable`, and those whose `isAvailable` says yes for it. */
export function availableRowActions<TData>(actions: readonly DataTableRowAction<TData>[], row: TData): readonly DataTableRowAction<TData>[] {
	return actions.filter((action) => action.isAvailable?.(row) ?? true);
}

/** The width an actions column needs for its inline buttons and the ⋯ menu, in pixels. */
export function rowActionsColumnWidth(actions: readonly DataTableRowAction<RowData>[]): number {
	const inlineCount = actions.filter((action) => action.inline === true).length;
	const hasMenu = actions.some((action) => action.inline !== true);
	return (hasMenu ? MENU_BUTTON_WIDTH_PX : 0) + inlineCount * INLINE_ACTION_WIDTH_PX + CELL_PADDING_PX;
}

/** Each tone's icon tile: the hue as text on its own soft fill. */
const ROW_ACTION_TONE_TILE_CLASS: Readonly<Record<DataTableRowActionTone, string>> = {
	blue: "bg-tone-blue-soft text-tone-blue",
	violet: "bg-tone-violet-soft text-tone-violet",
	teal: "bg-tone-teal-soft text-tone-teal",
	green: "bg-tone-green-soft text-tone-green",
	orange: "bg-tone-orange-soft text-tone-orange",
	yellow: "bg-tone-yellow-soft text-tone-yellow",
	destructive: "bg-destructive-soft text-destructive",
};

/** The ⋯ button, an inline action button and the cell's own padding, in pixels. */
const MENU_BUTTON_WIDTH_PX = 40;
const INLINE_ACTION_WIDTH_PX = 112;
const CELL_PADDING_PX = 24;

export interface RowActionsMenuProps<TData extends RowData> {
	/** The row's own data, handed to the chosen action. */
	readonly row: TData;
	readonly actions: readonly DataTableRowAction<TData>[];
	readonly labels: DataTableLabels;
}

export const RowActionsMenu = memoGeneric(function RowActionsMenu<TData extends RowData>({ row, actions, labels }: RowActionsMenuProps<TData>): React.JSX.Element {
	const [runState, setRunState] = React.useState<RowActionRunState>(IDLE);

	const handleStopPropagation = React.useCallback((event: React.SyntheticEvent): void => {
		event.stopPropagation();
	}, []);

	// One delegated handler: it reads the action key off the pressed control, so the controls bind no closures of their own.
	const handleActionClick = React.useCallback(
		(event: React.SyntheticEvent): void => {
			const key = event.currentTarget.getAttribute("data-action-key");
			const action = actions.find((candidate) => candidate.key === key);
			if (action !== undefined) {
				void runRowAction(action, row, setRunState);
			}
		},
		[actions, row],
	);

	// The column is as wide as every action needs (so it does not jump between rows); this row draws only its own.
	const offered = availableRowActions(actions, row);
	const inlineActions = offered.filter((action) => action.inline === true);
	const menuActions = offered.filter((action) => action.inline !== true);
	const pendingAction = actions.find((action) => action.key === runState.pendingKey);
	const failedAction = actions.find((action) => action.key === runState.failedKey);
	const isMenuActionPending = pendingAction !== undefined && pendingAction.inline !== true;
	const isMenuActionFailed = failedAction !== undefined && failedAction.inline !== true;

	return (
		// `data-cell-interactive`: the engine leaves presses on this to the controls (no row click, no cell selection).
		<div className="flex items-center justify-end gap-1" data-cell-interactive="" onClick={handleStopPropagation} onKeyDown={handleStopPropagation} role="presentation">
			{pendingAction === undefined ? null : (
				<span className="sr-only" role="status">
					{formatDataTableLabel(labels.rowActionPending, { label: pendingAction.label })}
				</span>
			)}

			{inlineActions.map((action) => {
				const isPending = action.key === runState.pendingKey;
				const isFailed = action.key === runState.failedKey;
				return (
					<Button
						key={action.key}
						type="button"
						size="sm"
						variant="outline"
						className={isFailed || action.tone === "destructive" ? DESTRUCTIVE_OUTLINE_CLASS_NAME : undefined}
						data-action-key={action.key}
						data-state={isPending ? "pending" : isFailed ? "failed" : "idle"}
						disabled={isPending}
						aria-busy={isPending ? true : undefined}
						aria-label={isFailed ? formatDataTableLabel(labels.rowActionFailed, { label: action.label }) : undefined}
						onClick={handleActionClick}>
						{isPending ? <Spinner aria-hidden /> : isFailed ? <CircleAlert aria-hidden="true" /> : action.icon}
						<span>{isFailed ? labels.retry : action.label}</span>
					</Button>
				);
			})}

			{/* A menu action that failed gets a retry button beside the menu, so the failure is not hidden behind it. */}
			{isMenuActionFailed ? (
				<Button
					type="button"
					size="icon-sm"
					variant="outline"
					className={DESTRUCTIVE_OUTLINE_CLASS_NAME}
					data-action-key={failedAction.key}
					aria-label={formatDataTableLabel(labels.rowActionFailed, { label: failedAction.label })}
					title={formatDataTableLabel(labels.rowActionFailed, { label: failedAction.label })}
					onClick={handleActionClick}>
					<CircleAlert aria-hidden="true" />
				</Button>
			) : null}

			{menuActions.length === 0 ? null : (
				<DropdownMenu>
					<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={isMenuActionPending} aria-busy={isMenuActionPending ? true : undefined} />}>
						<span className="sr-only">{labels.openRowMenu}</span>
						{isMenuActionPending ? <Spinner aria-hidden /> : <MoreHorizontal className="size-4" aria-hidden="true" />}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-64 p-2">
						<div className="mb-2 px-2 text-xs font-medium text-muted-foreground">{labels.actionsMenuTitle}</div>
						{/* Each entry carries its own emphasis (an icon tile and a description), so the highlight is the soft wash, never the inverted pill. */}
						{menuActions.map((action, position) => {
							const tone = resolveDataTableRowActionTone(action.tone, position);
							const isDestructive = tone === "destructive";
							return (
								<DropdownMenuItem
									key={action.key}
									data-action-key={action.key}
									onClick={handleActionClick}
									highlight="soft"
									variant={isDestructive ? "destructive" : "default"}
									className="flex cursor-pointer items-center gap-3 rounded-md p-3">
									{action.icon === undefined ? null : (
										<div aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", ROW_ACTION_TONE_TILE_CLASS[tone])}>
											{action.icon}
										</div>
									)}
									<div className="flex min-w-0 flex-col">
										<span className={cn("font-medium", isDestructive ? "text-destructive" : "text-foreground")}>{action.label}</span>
										<span className="text-xs text-muted-foreground">{action.description}</span>
									</div>
								</DropdownMenuItem>
							);
						})}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
});
