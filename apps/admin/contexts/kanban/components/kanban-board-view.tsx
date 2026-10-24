"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { trimUrlDraft, useUrlDraft } from "@workspace/client/lib/url-state/use-url-draft";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import {
	kanbanColumnIsDone,
	KanbanItemTypeSchema,
	kanbanTypesOnBoard,
	LIST_SLOT_INDEX,
	PERMISSION,
	type Envelope,
	type KanbanBoard,
	type KanbanBoardKind,
	type KanbanItemRef,
	type KanbanItemType,
	type KanbanTask,
	type KanbanTaskPriority,
	type KanbanTeam,
	type MoveKanbanTaskInput,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import type { KanbanCommitMeta } from "@workspace/ui/components/kanban";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import {
	anchorBefore,
	arrangeBoardValue,
	featureRollups,
	groupIntoLanes,
	hasActiveFilters,
	KANBAN_LANE_TYPES,
	replaceLane,
	toBoardValue,
	type KanbanBoardValue,
	type KanbanLane,
	type KanbanTaskFilters,
} from "../lib/kanban-board-model";
import { resolveGroupBy, resolveShowSubtasks, useKanbanBoardPreferences, type KanbanResolvedChoice } from "../lib/kanban-board-preferences";
import { itemCountLabel, KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import { emptyTaskFormValues, KANBAN_TASK_TEMPLATES, templateFormValues, type KanbanTaskFormValues } from "../lib/kanban-task-form";
import {
	KANBAN_BOARD_OF_PARAM,
	KANBAN_BOARD_URL_STATE,
	KANBAN_LANE_TYPE_OF_PARAM,
	type KanbanBoardParam,
	type KanbanLanes,
	type KanbanSort,
	type KanbanView,
} from "../url-state/kanban-board";
import { columnHeadingOf, KanbanBoardColumns, KanbanWipBadge, type KanbanColumnHeading, type KanbanColumnStep } from "./kanban-board-columns";
import { finishWarningFor, KanbanFinishWarningDialog, type KanbanFinishWarning } from "./kanban-finish-warning-dialog";
import { KanbanMoveToDialog, type KanbanMoveTarget } from "./kanban-move-to-dialog";
import { KanbanRollupStrip } from "./kanban-rollup-strip";
import { CreateKanbanTaskDialog } from "./create-kanban-task-dialog";
import { ImportKanbanTasksDialog } from "./import-kanban-tasks-dialog";
import { KanbanHierarchyView } from "./kanban-hierarchy-view";
import { KanbanLevelChip, KanbanStatusBadge } from "./kanban-task-badges";
import type { KanbanCardActions } from "./kanban-task-card";
import { KanbanTaskList } from "./kanban-task-list";
import { KanbanTaskTable } from "./kanban-task-table";
import { KanbanToolbar } from "./kanban-toolbar";
import { KanbanWipLimitDialog, type KanbanWipLimitTarget } from "./kanban-wip-limit-dialog";

/** How long the search box waits after the last keystroke before it updates the URL. */
const SEARCH_COMMIT_DELAY_MS = 300;
/** Skeleton columns drawn while the board loads. */
const SKELETON_COLUMN_COUNT = 4;

const MOVE_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_TASK_STALE: "Someone else moved or edited that card first. The board now shows the latest version.",
	KANBAN_COLUMN_STALE: "Someone else changed that column first. The board now shows the latest version.",
	KANBAN_COLUMN_FULL: "That column is full. Move or delete an item there first.",
	KANBAN_BOARD_MISMATCH: "Items stay on their own board.",
};

/** The level "Add …" starts with on each board: the one a team adds most. */
const DEFAULT_NEW_TYPE: Readonly<Record<KanbanBoardKind, KanbanItemType>> = { PLANNING: "FEATURE", EXECUTION: "STORY" };

/** One shared track for the column grid, so swimlanes line up under the header row. */
const COLUMN_GRID = "grid min-w-full auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3";

function taskHref(taskId: string): string {
	return ROUTES.kanban.task(taskId);
}

function noColumnStep(): void {
	// Columns are rearranged from the full board, never from inside a swimlane.
}

function BoardSkeleton(): React.JSX.Element {
	return (
		<div className="grid h-full auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3" aria-hidden>
			{Array.from({ length: SKELETON_COLUMN_COUNT }, (_, index) => (
				<div key={`skeleton-column-${String(index)}`} className="flex flex-col gap-2 rounded-lg bg-muted/60 p-2">
					<Skeleton className="m-1 h-4 w-24" />
					<Skeleton className="h-28 w-full rounded-md" />
					<Skeleton className="h-28 w-full rounded-md" />
				</div>
			))}
		</div>
	);
}

interface LaneSectionProps {
	readonly lane: KanbanLane;
	/** The whole board as shown, which a drag inside the lane is merged back into. */
	readonly shown: KanbanBoardValue;
	readonly laneType: KanbanItemType;
	readonly columns: readonly KanbanColumnHeading[];
	/** The column the lane's own item sits in, when it is on this board (a story lane's story). */
	readonly ownerColumn: KanbanColumnHeading | undefined;
	readonly isOpen: boolean;
	readonly onToggle: (laneKey: string) => void;
	readonly canDragTasks: boolean;
	readonly canCreateTasks: boolean;
	readonly onValueChange: (value: KanbanBoardValue) => void;
	readonly onCommit: (value: KanbanBoardValue, meta: KanbanCommitMeta<KanbanTask>) => void;
	readonly onDragFinish: () => void;
	readonly onAddTask: (columnId: string) => void;
	readonly cardActions: KanbanCardActions;
}

/**
 * One swimlane, the way a tracker groups a board: a bar naming its epic,
 * feature or story (or "No …") with its status and count, that folds the lane's
 * own row of columns away; a card moves within its lane.
 */
function LaneSection({
	lane,
	shown,
	laneType,
	columns,
	ownerColumn,
	isOpen,
	onToggle,
	canDragTasks,
	canCreateTasks,
	onValueChange,
	onCommit,
	onDragFinish,
	onAddTask,
	cardActions,
}: LaneSectionProps): React.JSX.Element {
	const handleToggle = React.useCallback((): void => {
		onToggle(lane.key);
	}, [lane.key, onToggle]);
	const display = KANBAN_TYPE_DISPLAY[laneType];
	const count = Object.values(lane.value).flat().length;
	const title = lane.owner?.title ?? `No ${display.label.toLowerCase()}`;
	// A lane's slice must hold every column the board has, even the empty ones, for the drop targets.
	const value = React.useMemo((): KanbanBoardValue => Object.fromEntries(columns.map((column) => [column.id, lane.value[column.id] ?? []])), [columns, lane.value]);
	const handleValueChange = React.useCallback(
		(next: KanbanBoardValue): void => {
			onValueChange(replaceLane(shown, lane.key, next, laneType));
		},
		[lane.key, laneType, onValueChange, shown],
	);
	const handleCommit = React.useCallback(
		(next: KanbanBoardValue, meta: KanbanCommitMeta<KanbanTask>): void => {
			onCommit(replaceLane(shown, lane.key, next, laneType), meta);
		},
		[lane.key, laneType, onCommit, shown],
	);
	return (
		<section aria-label={`${display.label}: ${title}`} className="flex flex-col gap-2">
			<div className="sticky left-0 flex w-fit max-w-full min-w-0 items-center gap-2 py-1 pr-2">
				<Button variant="ghost" size="icon-xs" aria-expanded={isOpen} aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`} onClick={handleToggle}>
					<ChevronRight className={isOpen ? "rotate-90 transition-transform duration-200" : "transition-transform duration-200"} />
				</Button>
				{lane.owner === null ? null : <KanbanLevelChip type={laneType} itemKey={lane.owner.key} />}
				{lane.owner === null ? (
					<span className="text-sm font-medium text-muted-foreground">{title}</span>
				) : (
					<Link href={taskHref(lane.owner.id)} className="truncate text-sm font-semibold hover:underline">
						{title}
					</Link>
				)}
				{ownerColumn === undefined ? null : <KanbanStatusBadge column={ownerColumn} size="sm" />}
				<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{itemCountLabel(count)}</span>
			</div>
			{isOpen ? (
				<KanbanBoardColumns
					columns={columns}
					value={value}
					canDragTasks={canDragTasks}
					canDragColumns={false}
					canCreateTasks={canCreateTasks}
					canManageColumns={false}
					showHeaders={false}
					taskHref={taskHref}
					onValueChange={handleValueChange}
					onCommit={handleCommit}
					onDragFinish={onDragFinish}
					onAddTask={onAddTask}
					onMoveColumn={noColumnStep}
					onSetWipLimit={noColumnStep}
					cardActions={cardActions}
				/>
			) : null}
		</section>
	);
}

export interface KanbanBoardViewProps {
	/** The board the server prefetched (real `meta`), seeded as the query's initial data when it is the board the URL asks for. */
	readonly initialBoard?: Envelope<KanbanBoard> | undefined;
}

/**
 * `/components/kanban-board` — the staff's two linked boards: Planning (epics
 * and features) and Execution (stories and tasks), switched in the toolbar.
 * Board / List / Table views of one `GET /admin/kanban/board?board=…`,
 * searched, filtered, sorted and — optionally — split into swimlanes by epic or
 * feature in the browser (a board is bounded); every choice lives in the URL. A
 * drag shows its result at once and is sent as one move (`…/move`, anchored on
 * the card or column it lands after); the API answers the whole board, which
 * replaces the cache — or, on a conflict, the latest board comes back. Columns
 * carry a soft WIP limit their header warns about.
 */
export function KanbanBoardView({ initialBoard }: KanbanBoardViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const queryClient = useQueryClient();
	const canCreateTasks = can(PERMISSION.KANBAN_TASK.CREATE);
	const canMoveTasks = can(PERMISSION.KANBAN_TASK.UPDATE);
	const canManageColumns = can(PERMISSION.KANBAN_TASK.MANAGE);

	const [urlState, updateUrlState] = useUrlState(KANBAN_BOARD_URL_STATE);
	const boardKind = KANBAN_BOARD_OF_PARAM[urlState.board];
	const commitSearch = React.useCallback(
		(value: string): void => {
			updateUrlState({ search: value.length === 0 ? undefined : value }, { history: "replace" });
		},
		[updateUrlState],
	);
	const [searchDraft, setSearchDraft] = useUrlDraft({ value: urlState.search ?? "", onCommit: commitSearch, delayMs: SEARCH_COMMIT_DELAY_MS, normalize: trimUrlDraft });

	const boardQuery = api.kanban.board.useQuery({ board: boardKind }, initialDataOption(initialBoard?.data.board === boardKind ? initialBoard : undefined));
	const board: KanbanBoard | undefined = boardQuery.data?.data;
	const columns = React.useMemo((): readonly KanbanColumnHeading[] => (board?.columns ?? []).map(columnHeadingOf), [board]);
	const boardPreferences = useKanbanBoardPreferences();
	const groupBy = resolveGroupBy(boardKind, urlState.lanes, boardPreferences.preferences, urlState.feature !== undefined);
	// Only the execution board holds subtasks; the planning board has nothing to hide.
	const showSubtasks: KanbanResolvedChoice<boolean> | null = boardKind === "EXECUTION" ? resolveShowSubtasks(urlState.subtasks, boardPreferences.preferences) : null;
	const serverValue = React.useMemo((): KanbanBoardValue => toBoardValue(board?.columns ?? []), [board]);
	const showSubtaskCards = showSubtasks?.value ?? true;
	const filters = React.useMemo(
		(): KanbanTaskFilters => ({
			search: urlState.search,
			priority: urlState.priority,
			team: urlState.team,
			type: urlState.type,
			feature: urlState.feature,
			// A type filter on subtasks shows them whatever the toggle says.
			showSubtasks: urlState.type === "SUBTASK" ? true : showSubtaskCards,
		}),
		[showSubtaskCards, urlState.feature, urlState.priority, urlState.search, urlState.team, urlState.type],
	);
	const arranged = React.useMemo((): KanbanBoardValue => arrangeBoardValue(serverValue, filters, urlState.sort), [filters, serverValue, urlState.sort]);

	// The board while a drag is shown but not yet confirmed by the API; `null` shows the server's.
	const [dragPreview, setDragPreview] = React.useState<KanbanBoardValue | null>(null);
	const [createDraft, setCreateDraft] = React.useState<KanbanTaskFormValues | null>(null);
	const [isImportOpen, setIsImportOpen] = React.useState(false);
	const [wipTarget, setWipTarget] = React.useState<KanbanWipLimitTarget | null>(null);
	// Lanes folded away, by lane key; every lane starts open.
	const [collapsedLanes, setCollapsedLanes] = React.useState<ReadonlySet<string>>(new Set());
	const [moveTarget, setMoveTarget] = React.useState<KanbanMoveTarget | null>(null);
	// A move into a done column with work still open under the item, waiting for the person to confirm it.
	const [pendingFinish, setPendingFinish] = React.useState<{ readonly warning: KanbanFinishWarning; readonly move: MoveKanbanTaskInput & { readonly taskId: string } } | null>(
		null,
	);

	const boardKey = apiRouter.kanban.board.queryKey({ board: boardKind });
	const onMoved = React.useCallback(
		(response: Envelope<KanbanBoard>): void => {
			queryClient.setQueryData(boardKey, response);
		},
		[boardKey, queryClient],
	);
	const onMoveFailed = React.useCallback(
		(error: Error): void => {
			toastMutationError("Could not save the change", error, MOVE_ERROR_MESSAGES);
			void queryClient.invalidateQueries({ queryKey: boardKey });
		},
		[boardKey, queryClient],
	);
	const clearPreview = React.useCallback((): void => {
		setDragPreview(null);
	}, []);
	const moveTask = api.kanban.moveTask.useMutation({ onSuccess: onMoved, onError: onMoveFailed, onSettled: clearPreview });
	const moveColumn = api.kanban.moveColumn.useMutation({ onSuccess: onMoved, onError: onMoveFailed, onSettled: clearPreview });
	const updateColumn = api.kanban.updateColumn.useMutation({
		onSuccess: (response: Envelope<KanbanBoard>): void => {
			onMoved(response);
			setWipTarget(null);
			toastMessage.success({ title: "WIP limit saved" });
		},
		onError: onMoveFailed,
	});

	const versionOfTask = React.useCallback(
		(taskId: string): number | undefined =>
			Object.values(serverValue)
				.flat()
				.find((task) => task.id === taskId)?.version,
		[serverValue],
	);
	const versionOfColumn = React.useCallback((columnId: string): number | undefined => board?.columns.find((column) => column.id === columnId)?.version, [board]);

	const taskById = React.useMemo(
		(): ReadonlyMap<string, KanbanTask> => new Map(Object.values(serverValue).flatMap((tasks) => tasks.map((task): [string, KanbanTask] => [task.id, task]))),
		[serverValue],
	);
	/**
	 * Sends a card's move — unless it finishes the item (a done or delivered
	 * column) while work under it is still open: then the person confirms first.
	 */
	const requestTaskMove = React.useCallback(
		(move: MoveKanbanTaskInput & { readonly taskId: string }): void => {
			const task = taskById.get(move.taskId);
			const from = columns.find((column) => column.id === task?.columnId);
			const to = columns.find((column) => column.id === move.columnId);
			const warning =
				task === undefined || to === undefined || !kanbanColumnIsDone(to) || (from !== undefined && kanbanColumnIsDone(from))
					? null
					: finishWarningFor(task, to.board === "PLANNING" ? "Delivered" : "Done");
			if (warning === null) {
				moveTask.mutate(move);
				return;
			}
			setPendingFinish({ warning, move });
		},
		[columns, moveTask, taskById],
	);
	const confirmFinish = React.useCallback((): void => {
		if (pendingFinish !== null) {
			moveTask.mutate(pendingFinish.move);
		}
		setPendingFinish(null);
	}, [moveTask, pendingFinish]);
	const cancelFinish = React.useCallback((): void => {
		setPendingFinish(null);
		setDragPreview(null);
	}, []);

	const sendColumnMove = React.useCallback(
		(columnId: string, order: readonly string[]): void => {
			const version = versionOfColumn(columnId);
			if (version !== undefined) {
				moveColumn.mutate({ columnId, afterColumnId: anchorBefore(order, columnId), version });
			}
		},
		[moveColumn, versionOfColumn],
	);

	const handleCommit = React.useCallback(
		(next: KanbanBoardValue, meta: KanbanCommitMeta<KanbanTask>): void => {
			const movedId = String(meta.event.active.id);
			setDragPreview(next);
			if (meta.kind === "column") {
				sendColumnMove(movedId, Object.keys(next));
				return;
			}
			const version = versionOfTask(movedId);
			const target = next[meta.overContainer] ?? [];
			if (version === undefined) {
				setDragPreview(null);
				return;
			}
			requestTaskMove({
				taskId: movedId,
				columnId: meta.overContainer,
				afterTaskId: anchorBefore(
					target.map((task) => task.id),
					movedId,
				),
				version,
			});
		},
		[requestTaskMove, sendColumnMove, versionOfTask],
	);

	const handleMoveColumn = React.useCallback(
		(columnId: string, step: KanbanColumnStep): void => {
			const order = columns.map((column) => column.id);
			const index = order.indexOf(columnId);
			const target = step === "left" ? index - 1 : index + 1;
			if (index < 0 || target < 0 || target >= order.length) {
				return;
			}
			const reordered = order.filter((id) => id !== columnId);
			reordered.splice(target, 0, columnId);
			sendColumnMove(columnId, reordered);
		},
		[columns, sendColumnMove],
	);
	const handleSetWipLimit = React.useCallback(
		(columnId: string): void => {
			const column = columns.find((candidate) => candidate.id === columnId);
			if (column !== undefined) {
				setWipTarget({ columnId, title: column.title, wipLimit: column.wipLimit });
			}
		},
		[columns],
	);
	const saveWipLimit = React.useCallback(
		(columnId: string, wipLimit: number | null): void => {
			const version = versionOfColumn(columnId);
			if (version !== undefined) {
				updateColumn.mutate({ columnId, wipLimit, version });
			}
		},
		[updateColumn, versionOfColumn],
	);
	const closeWipLimit = React.useCallback((): void => {
		setWipTarget(null);
	}, []);

	const firstColumnId = columns.at(LIST_SLOT_INDEX.first)?.id ?? "";
	const newType = urlState.type ?? DEFAULT_NEW_TYPE[boardKind];
	const handleAddTask = React.useCallback((): void => {
		setCreateDraft(emptyTaskFormValues({ columnId: firstColumnId, type: newType }));
	}, [firstColumnId, newType]);
	const handleAddTaskTo = React.useCallback(
		(columnId: string): void => {
			setCreateDraft(emptyTaskFormValues({ columnId, type: newType }));
		},
		[newType],
	);
	const handleAddFromTemplate = React.useCallback(
		(templateKey: string): void => {
			const template = KANBAN_TASK_TEMPLATES.find((candidate) => candidate.key === templateKey);
			if (template !== undefined) {
				setCreateDraft(templateFormValues(template, { columnId: firstColumnId, type: newType }));
			}
		},
		[firstColumnId, newType],
	);
	const closeCreate = React.useCallback((): void => {
		setCreateDraft(null);
	}, []);
	const openImport = React.useCallback((): void => {
		setIsImportOpen(true);
	}, []);
	const closeImport = React.useCallback((): void => {
		setIsImportOpen(false);
	}, []);

	const handleBoardChange = React.useCallback(
		(next: KanbanBoardParam): void => {
			// A type filter belongs to one board; the other board never shows that type.
			updateUrlState({ board: next, type: undefined });
			setDragPreview(null);
		},
		[updateUrlState],
	);
	const handleViewChange = React.useCallback(
		(view: KanbanView): void => {
			// The tree spans both boards, so it offers every type; back on one board, a type it never shows is dropped.
			const keepsType = view === "hierarchy" || urlState.type === undefined || kanbanTypesOnBoard(boardKind).includes(urlState.type);
			updateUrlState(keepsType ? { view } : { view, type: undefined });
		},
		[boardKind, updateUrlState, urlState.type],
	);
	const { saveGroupBy, saveShowSubtasks, reset: resetBoardPreferences } = boardPreferences;
	const handleLanesChange = React.useCallback(
		(lanes: KanbanLanes): void => {
			updateUrlState({ lanes });
			saveGroupBy(boardKind, lanes);
			setCollapsedLanes(new Set());
		},
		[boardKind, saveGroupBy, updateUrlState],
	);
	const handleShowSubtasksChange = React.useCallback(
		(show: boolean): void => {
			updateUrlState({ subtasks: show });
			saveShowSubtasks(show);
		},
		[saveShowSubtasks, updateUrlState],
	);
	const toggleSubtasks = React.useCallback((): void => {
		handleShowSubtasksChange(!showSubtaskCards);
	}, [handleShowSubtasksChange, showSubtaskCards]);
	const handleResetGrouping = React.useCallback((): void => {
		resetBoardPreferences(boardKind);
		updateUrlState({ lanes: undefined, subtasks: undefined });
		setCollapsedLanes(new Set());
	}, [boardKind, resetBoardPreferences, updateUrlState]);
	const handleSelectFeature = React.useCallback(
		(feature: string | undefined): void => {
			updateUrlState({ feature });
			setCollapsedLanes(new Set());
		},
		[updateUrlState],
	);
	const toggleRollup = React.useCallback((): void => {
		updateUrlState({ rollup: urlState.rollup === "open" ? "closed" : "open" });
	}, [updateUrlState, urlState.rollup]);
	const rollupRows = React.useMemo(() => (board?.board === "EXECUTION" ? featureRollups(board.columns, kanbanColumnIsDone) : []), [board]);

	const openMoveTo = React.useCallback((task: KanbanTask): void => {
		const parent = task.ancestors.at(task.ancestors.length - 1);
		setMoveTarget({
			id: task.id,
			key: task.key,
			type: task.type,
			title: task.title,
			version: task.version,
			parentId: task.parentId,
			parent: parent === undefined ? null : { id: parent.id, key: parent.key, type: parent.type, title: parent.title },
		});
	}, []);
	const closeMoveTo = React.useCallback((): void => {
		setMoveTarget(null);
	}, []);
	/** A moved item that left the feature the board is narrowed to: follow it to its new feature, so it stays in view. */
	const handleMoved = React.useCallback(
		(parent: KanbanItemRef | null): void => {
			if (urlState.feature === undefined || parent === null) {
				return;
			}
			const feature = parent.type === "FEATURE" ? parent.id : taskById.get(parent.id)?.ancestors.find((ancestor) => ancestor.type === "FEATURE")?.id;
			if (feature !== undefined && feature !== urlState.feature) {
				updateUrlState({ feature });
			}
		},
		[taskById, updateUrlState, urlState.feature],
	);
	const handleMoveToColumn = React.useCallback(
		(task: KanbanTask, columnId: string): void => {
			requestTaskMove({ taskId: task.id, columnId, afterTaskId: null, version: task.version });
		},
		[requestTaskMove],
	);
	const handleToggleLane = React.useCallback((laneKey: string): void => {
		setCollapsedLanes((current) => {
			const next = new Set(current);
			if (next.has(laneKey)) {
				next.delete(laneKey);
			} else {
				next.add(laneKey);
			}
			return next;
		});
	}, []);
	const handlePriorityChange = React.useCallback(
		(priority: KanbanTaskPriority | undefined): void => {
			updateUrlState({ priority });
		},
		[updateUrlState],
	);
	const handleTeamChange = React.useCallback(
		(team: KanbanTeam | undefined): void => {
			updateUrlState({ team });
		},
		[updateUrlState],
	);
	const handleTypeChange = React.useCallback(
		(type: KanbanItemType | undefined): void => {
			updateUrlState({ type });
		},
		[updateUrlState],
	);
	const handleSortChange = React.useCallback(
		(sort: KanbanSort): void => {
			updateUrlState({ sort });
		},
		[updateUrlState],
	);
	const handleRetry = React.useCallback((): void => {
		void boardQuery.refetch();
	}, [boardQuery]);

	const requestedLaneType = KANBAN_LANE_TYPE_OF_PARAM[groupBy.value];
	// A level this board cannot group by (a story lane on the planning board) shows no lanes.
	const laneType = requestedLaneType !== null && KANBAN_LANE_TYPES[boardKind].includes(requestedLaneType) ? requestedLaneType : null;
	const isBusy = moveTask.isPending || moveColumn.isPending;
	// A sorted view is read-only: dropping a card into it could not say where it belongs in the board's own order.
	const canDragTasks = canMoveTasks && urlState.sort === "manual" && !isBusy;
	// Column order is the whole board's: rearranging is offered only while every card is shown, outside swimlanes.
	const canDragColumns = canManageColumns && !hasActiveFilters(filters) && laneType === null && !isBusy;
	const shown = dragPreview ?? arranged;
	const cardActions = React.useMemo(
		(): KanbanCardActions => ({
			onMoveTo: canMoveTasks ? openMoveTo : undefined,
			onMoveToColumn: canMoveTasks && !isBusy ? handleMoveToColumn : undefined,
			onToggleSubtasks: showSubtasks === null ? undefined : toggleSubtasks,
			subtasksShown: showSubtaskCards,
		}),
		[canMoveTasks, handleMoveToColumn, isBusy, openMoveTo, showSubtaskCards, showSubtasks, toggleSubtasks],
	);
	const lanes = React.useMemo((): readonly KanbanLane[] => (laneType === null ? [] : groupIntoLanes(shown, laneType)), [laneType, shown]);
	const columnOfTask = React.useMemo((): ReadonlyMap<string, KanbanColumnHeading> => {
		const headings = new Map(columns.map((column) => [column.id, column]));
		return new Map(
			Object.entries(serverValue).flatMap(([columnId, tasks]) => {
				const heading = headings.get(columnId);
				return heading === undefined ? [] : tasks.map((task): [string, KanbanColumnHeading] => [task.id, heading]);
			}),
		);
	}, [columns, serverValue]);
	const expandAllLanes = React.useCallback((): void => {
		setCollapsedLanes(new Set());
	}, []);
	const collapseAllLanes = React.useCallback((): void => {
		setCollapsedLanes(new Set(lanes.map((lane) => lane.key)));
	}, [lanes]);

	let content: React.ReactNode;
	if (urlState.view === "hierarchy") {
		// Remounted when the filters change, so a filtered tree opens fully and a cleared one folds back.
		content = <KanbanHierarchyView key={JSON.stringify(filters)} filters={filters} />;
	} else if (board?.board !== boardKind) {
		content = boardQuery.isError ? (
			<div role="alert" className="flex flex-col items-start gap-3 p-6">
				<p className="text-sm text-destructive">Could not load the board.</p>
				<Button variant="outline" onClick={handleRetry}>
					Try again
				</Button>
			</div>
		) : (
			<div className="h-full p-4 lg:p-5">
				<BoardSkeleton />
			</div>
		);
	} else if (urlState.view === "list") {
		content = <KanbanTaskList columns={columns} tasksByColumn={arranged} taskHref={taskHref} />;
	} else if (urlState.view === "table") {
		content = <KanbanTaskTable columns={columns} tasksByColumn={arranged} taskHref={taskHref} />;
	} else if (laneType !== null) {
		content = (
			<div className="h-full overflow-auto px-4 pb-6 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] lg:px-5">
				<div className="flex w-max min-w-full flex-col gap-3">
					<div className={`${COLUMN_GRID} sticky top-0 z-10 bg-card pt-3 pb-1 lg:pt-5`}>
						{columns.map((column) => (
							<div key={column.id} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2.5">
								<h2 className="truncate text-sm font-semibold text-foreground/80">{column.title}</h2>
								<span className="text-xs text-muted-foreground tabular-nums">{itemCountLabel(shown[column.id]?.length ?? 0)}</span>
								<KanbanWipBadge column={column} />
							</div>
						))}
					</div>
					<div className="sticky left-0 flex w-fit items-center gap-1">
						<Button variant="ghost" size="sm" onClick={expandAllLanes}>
							<ChevronsUpDown data-icon="inline-start" />
							Expand all
						</Button>
						<Button variant="ghost" size="sm" onClick={collapseAllLanes}>
							<ChevronsDownUp data-icon="inline-start" />
							Collapse all
						</Button>
					</div>
					{lanes.length === 0 ? <p className="text-sm text-muted-foreground">No items match.</p> : null}
					{lanes.map((lane) => (
						<LaneSection
							key={lane.key}
							lane={lane}
							shown={shown}
							laneType={laneType}
							columns={columns}
							ownerColumn={lane.owner === null ? undefined : columnOfTask.get(lane.owner.id)}
							isOpen={!collapsedLanes.has(lane.key)}
							onToggle={handleToggleLane}
							canDragTasks={canDragTasks}
							canCreateTasks={canCreateTasks}
							onValueChange={setDragPreview}
							onCommit={handleCommit}
							onDragFinish={clearPreview}
							onAddTask={handleAddTaskTo}
							cardActions={cardActions}
						/>
					))}
				</div>
			</div>
		);
	} else {
		content = (
			<div className="h-full overflow-x-auto overflow-y-hidden px-4 pt-3 pb-3 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] lg:px-5 lg:pt-5">
				<KanbanBoardColumns
					columns={columns}
					value={shown}
					canDragTasks={canDragTasks}
					canDragColumns={canDragColumns}
					canCreateTasks={canCreateTasks}
					canManageColumns={canManageColumns}
					taskHref={taskHref}
					onValueChange={setDragPreview}
					onCommit={handleCommit}
					onDragFinish={clearPreview}
					onAddTask={handleAddTaskTo}
					onMoveColumn={handleMoveColumn}
					onSetWipLimit={handleSetWipLimit}
					cardActions={cardActions}
				/>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100dvh-8.5rem)] min-h-[40rem] min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
			<h1 className="sr-only">Kanban board</h1>
			<KanbanToolbar
				board={urlState.board}
				onBoardChange={handleBoardChange}
				view={urlState.view}
				onViewChange={handleViewChange}
				lanes={laneType === null ? "none" : groupBy.value}
				laneTypes={KANBAN_LANE_TYPES[boardKind]}
				onLanesChange={handleLanesChange}
				lanesSource={groupBy.source}
				showSubtasks={showSubtasks?.value}
				onShowSubtasksChange={showSubtasks === null ? undefined : handleShowSubtasksChange}
				onResetGrouping={handleResetGrouping}
				search={searchDraft}
				onSearchChange={setSearchDraft}
				priority={urlState.priority}
				onPriorityChange={handlePriorityChange}
				team={urlState.team}
				onTeamChange={handleTeamChange}
				type={urlState.type}
				types={urlState.view === "hierarchy" ? KanbanItemTypeSchema.options : kanbanTypesOnBoard(boardKind)}
				onTypeChange={handleTypeChange}
				sort={urlState.sort}
				onSortChange={handleSortChange}
				canCreateTasks={canCreateTasks}
				addLabel={`Add ${KANBAN_TYPE_DISPLAY[newType].label.toLowerCase()}`}
				templates={KANBAN_TASK_TEMPLATES}
				onAddTask={handleAddTask}
				onAddFromTemplate={handleAddFromTemplate}
				onImportCsv={openImport}
			/>
			{boardKind === "EXECUTION" && urlState.view !== "hierarchy" ? (
				<KanbanRollupStrip
					rows={rollupRows}
					isOpen={urlState.rollup === "open"}
					onToggle={toggleRollup}
					selectedFeatureId={urlState.feature}
					onSelectFeature={handleSelectFeature}
				/>
			) : null}
			<div className={urlState.view === "board" ? "min-h-0 flex-1" : "min-h-0 flex-1 overflow-y-auto"}>{content}</div>
			<CreateKanbanTaskDialog draft={createDraft} board={boardKind} columns={columns} onClose={closeCreate} />
			<ImportKanbanTasksDialog open={isImportOpen} board={boardKind} columns={board?.columns ?? []} onClose={closeImport} />
			<KanbanWipLimitDialog target={wipTarget} isPending={updateColumn.isPending} onSave={saveWipLimit} onClose={closeWipLimit} />
			<KanbanMoveToDialog target={moveTarget} onClose={closeMoveTo} onMoved={handleMoved} />
			<KanbanFinishWarningDialog warning={pendingFinish?.warning ?? null} onConfirm={confirmFinish} onCancel={cancelFinish} />
		</div>
	);
}
