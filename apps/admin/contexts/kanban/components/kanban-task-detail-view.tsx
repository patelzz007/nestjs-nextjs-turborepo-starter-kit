"use client";

import { useQueryClient } from "@tanstack/react-query";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { KANBAN_PARENT_TYPE, kanbanColumnIsDone, PERMISSION, type Envelope, type KanbanTaskDetail } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import { ArrowRightLeft, CircleDot, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { DetailBreadcrumb } from "@/components/common/detail-breadcrumb";
import { useResourceDeleteDialog } from "@/components/common/resource-delete-dialog";
import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";
import { usePublishFocusActions, type FocusAction, type FocusActions } from "@/lib/palette/focus-actions";
import { ROUTES } from "@/lib/routes";

import { invalidateKanban, invalidateKanbanBoards } from "../lib/kanban-cache";
import { KANBAN_BOARD_DISPLAY, KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import { kanbanBoardHref } from "../lib/kanban-links";
import { KanbanTaskAttachments } from "./kanban-task-attachments";
import { finishWarningFor, KanbanFinishWarningDialog, type KanbanFinishWarning } from "./kanban-finish-warning-dialog";
import { KanbanMoveToDialog, type KanbanMoveTarget } from "./kanban-move-to-dialog";
import { KanbanBlockedBadge, KanbanLevelChip, KanbanTypeIcon } from "./kanban-task-badges";
import { KanbanTaskComments } from "./kanban-task-comments";
import { KanbanTaskProperties, KanbanWatchButton } from "./kanban-task-overview";
import { KanbanActivitySection, KanbanChecklistSection, KanbanChildrenSection, KanbanLinksSection } from "./kanban-task-sections";

const DELETE_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_ITEM_HAS_CHILDREN: "Delete or move its children first.",
};

const STATUS_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_TASK_STALE: "Someone else moved or edited this item first. Reload it and try again.",
	KANBAN_COLUMN_FULL: "That column is full. Move or delete an item there first.",
};

/** Property rows the loading page sketches. */
const SKELETON_PROPERTY_COUNT = 8;

/** The page's shape while the item loads. */
export function KanbanTaskDetailSkeleton(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-6" aria-hidden>
			<Skeleton className="h-4 w-72" />
			<div className="mt-6 flex flex-col gap-4">
				<Skeleton className="size-11 rounded-lg" />
				<Skeleton className="h-10 w-2/3" />
			</div>
			<div className="flex flex-col gap-2">
				{Array.from({ length: SKELETON_PROPERTY_COUNT }, (_, index) => (
					<Skeleton key={`skeleton-property-${String(index)}`} className="h-7 w-full max-w-md" />
				))}
			</div>
			<Skeleton className="h-32 w-full" />
		</div>
	);
}

/** Board / epic / feature / story / task / this item: every level a link, each with its level's icon and key. */
function HierarchyTrail({ task }: { readonly task: KanbanTaskDetail }): React.JSX.Element {
	return (
		<nav aria-label="Hierarchy" className="min-w-0">
			<ol className="flex min-w-0 items-center gap-1 overflow-hidden text-sm whitespace-nowrap text-muted-foreground">
				<li className="shrink-0">
					<Link href={kanbanBoardHref(task.column.board)} className="rounded-sm px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground">
						{KANBAN_BOARD_DISPLAY[task.column.board].label} board
					</Link>
				</li>
				{task.ancestors.map((ancestor) => (
					<li key={ancestor.id} className="flex min-w-0 items-center gap-1">
						<span aria-hidden className="text-muted-foreground/60">
							/
						</span>
						<Link
							href={ROUTES.kanban.task(ancestor.id)}
							className="flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground">
							<KanbanTypeIcon type={ancestor.type} />
							{ancestor.key === null ? null : <span className="shrink-0 font-mono text-xs">{ancestor.key}</span>}
							<span className="max-w-40 truncate">{ancestor.title}</span>
						</Link>
					</li>
				))}
				<li className="flex min-w-0 items-center gap-1" aria-current="page">
					<span aria-hidden className="text-muted-foreground/60">
						/
					</span>
					<span className="truncate px-1 text-foreground">{task.title}</span>
				</li>
			</ol>
		</nav>
	);
}

export interface KanbanTaskDetailViewProps {
	readonly taskId: string;
	/** The server-prefetched `GET /admin/kanban/tasks/:taskId` envelope, or `undefined` when the prefetch failed. */
	readonly initialTask?: Envelope<KanbanTaskDetail> | undefined;
}

/**
 * `/components/kanban-board/tasks/[id]` — one item, read-only: where it sits in
 * the hierarchy, how far it has got (in the measure its level uses), its
 * description, checklist, children, links, files and discussion, its details,
 * watchers and history. Ticking a checklist row, linking, watching and
 * commenting happen in place; editing is its own page (`/edit`); deleting
 * soft-deletes it once it has no children.
 */
export function KanbanTaskDetailView({ taskId, initialTask }: KanbanTaskDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const router = useRouter();
	const queryClient = useQueryClient();
	const canUpdate = can(PERMISSION.KANBAN_TASK.UPDATE);
	const canDelete = can(PERMISSION.KANBAN_TASK.DELETE);
	const canCreate = can(PERMISSION.KANBAN_TASK.CREATE);
	const { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
	const taskQuery = api.kanban.task.useQuery({ taskId }, initialDataOption(initialTask));
	const task = taskQuery.data?.data;
	// Read once per render of the page: what counts as overdue.
	const [now] = React.useState(Date.now);
	const [moveTarget, setMoveTarget] = React.useState<KanbanMoveTarget | null>(null);
	const openMoveTo = React.useCallback((): void => {
		if (task === undefined) {
			return;
		}
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
	}, [task]);
	const closeMoveTo = React.useCallback((): void => {
		setMoveTarget(null);
	}, []);

	// "Change status…" from the command palette: the item's board's other columns, each one move to its top.
	const boardQuery = api.kanban.board.useQuery({ board: task?.column.board ?? "EXECUTION" }, { enabled: task !== undefined && canUpdate });
	const [pendingFinish, setPendingFinish] = React.useState<{ readonly warning: KanbanFinishWarning; readonly columnId: string } | null>(null);
	const moveTask = api.kanban.moveTask.useMutation({
		onSuccess: async (): Promise<void> => {
			await Promise.all([invalidateKanbanBoards(queryClient), taskQuery.refetch()]);
			toastMessage.success({ title: "Status changed" });
		},
		onError: (error) => {
			toastMutationError("Could not change the status", error, STATUS_ERROR_MESSAGES);
		},
	});
	const sendStatus = React.useCallback(
		(columnId: string): void => {
			if (task !== undefined) {
				moveTask.mutate({ taskId: task.id, columnId, afterTaskId: null, version: task.version });
			}
		},
		[moveTask, task],
	);
	const confirmFinish = React.useCallback((): void => {
		if (pendingFinish !== null) {
			sendStatus(pendingFinish.columnId);
		}
		setPendingFinish(null);
	}, [pendingFinish, sendStatus]);
	const cancelFinish = React.useCallback((): void => {
		setPendingFinish(null);
	}, []);
	const focusActions = React.useMemo((): FocusActions | null => {
		if (task === undefined || !canUpdate) {
			return null;
		}
		const columns = boardQuery.data?.data.columns ?? [];
		const statusActions = columns
			.filter((column) => column.id !== task.columnId)
			.map((column): FocusAction => ({
				id: `status-${column.id}`,
				label: `Change status to ${column.title}`,
				icon: CircleDot,
				keywords: ["status", "column", "move"],
				run: (): void => {
					const warning = kanbanColumnIsDone(column) && !kanbanColumnIsDone(task.column) ? finishWarningFor(task, column.board === "PLANNING" ? "Delivered" : "Done") : null;
					if (warning === null) {
						sendStatus(column.id);
					} else {
						setPendingFinish({ warning, columnId: column.id });
					}
				},
			}));
		return {
			heading: task.key ?? task.title,
			actions: [
				...(KANBAN_PARENT_TYPE[task.type] === null ? [] : [{ id: "move-to", label: "Move to…", icon: ArrowRightLeft, keywords: ["parent", "reparent"], run: openMoveTo }]),
				...statusActions,
				{
					id: "edit",
					label: "Edit",
					icon: Pencil,
					run: (): void => {
						router.push(ROUTES.kanban.editTask(task.id));
					},
				},
			],
		};
	}, [boardQuery.data, canUpdate, openMoveTo, router, sendStatus, task]);
	usePublishFocusActions(focusActions);

	const deleteTask = api.kanban.deleteTask.useMutation({
		onSuccess: async () => {
			await invalidateKanban(queryClient, [task?.parentId ?? null]);
			toastMessage.success({ title: "Item deleted" });
			router.push(task === undefined ? ROUTES.kanban.board : kanbanBoardHref(task.column.board));
		},
		onError: (error) => {
			toastMutationError("Could not delete the item", error, DELETE_ERROR_MESSAGES);
		},
	});

	const handleDelete = React.useCallback((): void => {
		if (task === undefined) {
			return;
		}
		void requestDelete({
			title: `Delete "${task.title}"?`,
			description: "It leaves the board with its comments, attachments, checklist and links.",
			onConfirm: async (): Promise<void> => {
				await deleteTask.mutateAsync({ taskId: task.id });
			},
		});
	}, [deleteTask, requestDelete, task]);

	if (task === undefined) {
		return taskQuery.isError ? (
			<div className="flex flex-col items-start gap-4">
				<Link href={ROUTES.kanban.board} className={buttonVariants({ variant: "outline" })}>
					Back to the board
				</Link>
				<p role="alert" className="text-destructive">
					Could not load this item.
				</p>
			</div>
		) : (
			<KanbanTaskDetailSkeleton />
		);
	}

	const typeLabel = KANBAN_TYPE_DISPLAY[task.type].label;

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col pb-16">
			<DetailBreadcrumb label={task.title} />
			<header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<HierarchyTrail task={task} />
				<div className="flex shrink-0 items-center gap-0.5">
					<KanbanWatchButton task={task} />
					{canUpdate && KANBAN_PARENT_TYPE[task.type] !== null ? (
						<Button variant="ghost" size="sm" onClick={openMoveTo}>
							<ArrowRightLeft data-icon="inline-start" />
							Move to…
						</Button>
					) : null}
					{canUpdate ? (
						<Link href={ROUTES.kanban.editTask(task.id)} aria-label={`Edit ${typeLabel.toLowerCase()}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
							<Pencil data-icon="inline-start" />
							Edit
						</Link>
					) : null}
					{canDelete ? (
						<Button
							variant="ghost"
							size="icon-sm"
							className="text-muted-foreground hover:text-destructive"
							aria-label="Delete"
							title={`Delete this ${typeLabel.toLowerCase()}`}
							onClick={handleDelete}>
							<Trash2 />
						</Button>
					) : null}
				</div>
			</header>

			<div className="mt-10 flex flex-col items-start gap-4">
				<KanbanTypeIcon type={task.type} size="lg" />
				<KanbanLevelChip type={task.type} itemKey={task.key} showIcon={false} />
				<h1 className="-mt-2 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">{task.title}</h1>
				{task.isBlocked && !kanbanColumnIsDone(task.column) ? <KanbanBlockedBadge /> : null}
			</div>

			<div className="mt-6">
				<KanbanTaskProperties task={task} now={now} />
			</div>

			<div className="mt-6 border-t pt-6">
				{task.description.length > 0 ? (
					<p className="max-w-prose text-base leading-7 whitespace-pre-wrap">{task.description}</p>
				) : (
					<p className="text-base leading-7 text-muted-foreground">No description yet.</p>
				)}
			</div>

			<div className="mt-10 flex flex-col gap-10">
				<KanbanChecklistSection task={task} canEdit={canUpdate} editHref={ROUTES.kanban.editTask(task.id)} />
				<KanbanChildrenSection task={task} canCreate={canCreate} />
				<KanbanLinksSection task={task} canEdit={canUpdate} />
				<KanbanTaskAttachments taskId={task.id} attachments={task.attachments} canEdit={canUpdate} />
				<KanbanTaskComments taskId={task.id} canComment={canUpdate} />
				<KanbanActivitySection taskId={task.id} />
			</div>
			{resourceDeleteDialog}
			<KanbanMoveToDialog target={moveTarget} onClose={closeMoveTo} />
			<KanbanFinishWarningDialog warning={pendingFinish?.warning ?? null} onConfirm={confirmFinish} onCancel={cancelFinish} />
		</div>
	);
}
