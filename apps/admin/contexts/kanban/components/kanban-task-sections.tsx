"use client";

import { readPaginatedHasNext, readPaginatedHasPrevious, readPaginatedTotalPages } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	KANBAN_BOARD_OF_TYPE,
	KANBAN_CHILD_TYPE,
	KanbanItemTypeSchema,
	KanbanLinkKindSchema,
	LIST_SLOT_INDEX,
	type KanbanItemSummary,
	type KanbanLink,
	type KanbanLinkKind,
	type KanbanPerson,
	type KanbanTaskDetail,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import { ListPager } from "@workspace/ui/components/list-pager";
import { TimelineDate } from "@workspace/ui/components/timeline";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronRight, Plus, Unlink } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { OptionSelectField } from "@/components/common/form-fields";
import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";
import { formatDateTime } from "@/lib/format/dates";
import { ROUTES } from "@/lib/routes";

import { describeActivity, formatRelativeTime, KANBAN_LINK_KIND_LABEL, KANBAN_STEP_DEPTH_LABEL, KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import { kanbanBoardHref } from "../lib/kanban-links";
import { emptyTaskFormValues, type KanbanTaskFormValues } from "../lib/kanban-task-form";
import { useKanbanItemUpdate } from "../lib/use-kanban-item-update";
import { columnHeadingOf, type KanbanColumnHeading } from "./kanban-board-columns";
import { CreateKanbanTaskDialog } from "./create-kanban-task-dialog";
import { KanbanItemPicker } from "./kanban-pickers";
import { KanbanPageSection } from "./kanban-page-section";
import { KanbanAssignee } from "./kanban-person";
import { KanbanPersonTimeline, KanbanPersonTimelineItem } from "./kanban-person-timeline";
import { KanbanLevelChip, KanbanPointsPill, KanbanStatusBadge } from "./kanban-task-badges";

/** How far each checklist level is indented. */
const INDENT_CLASS: readonly string[] = ["", "pl-9", "pl-16"];
/** History entries per page, newest first. */
const ACTIVITY_PAGE_SIZE = 15;

const CHECKLIST_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_CHECKLIST_ITEM_NOT_FOUND: "That row was removed meanwhile. The page now shows the latest list.",
};

const LINK_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_LINK_EXISTS: "These items are linked already.",
	KANBAN_LINK_INVALID: "Link to another live item.",
	KANBAN_LINK_NOT_FOUND: "That link was removed meanwhile.",
};

// ── Checklist ─────────────────────────────────────────────────────────────────

interface ChecklistRowProps {
	readonly id: string;
	readonly title: string;
	readonly depth: number;
	readonly isDone: boolean;
	readonly assignee?: KanbanPerson | null | undefined;
	readonly canEdit: boolean;
	readonly isPending: boolean;
	readonly onToggle: (itemId: string, isDone: boolean) => void;
}

function ChecklistRow({ id, title, depth, isDone, assignee, canEdit, isPending, onToggle }: ChecklistRowProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(checked: boolean): void => {
			onToggle(id, checked);
		},
		[id, onToggle],
	);
	const level = KANBAN_STEP_DEPTH_LABEL.at(depth) ?? "Step";
	return (
		<li className={cn("-mx-2 flex min-h-8 items-center gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-muted/50", INDENT_CLASS.at(depth))}>
			<Checkbox checked={isDone} disabled={!canEdit || isPending} onCheckedChange={handleChange} aria-label={`${title} done`} />
			<span className={cn("min-w-0 flex-1 text-base leading-6", isDone && "text-muted-foreground line-through")} title={depth > 0 ? level : undefined}>
				{title}
			</span>
			{assignee === undefined ? null : <KanbanAssignee person={assignee} compact />}
		</li>
	);
}

/**
 * A task's subtask tree, or a feature's or story's acceptance criteria, each
 * row ticked off in place (`PATCH …/checklist/:itemId`); the rows themselves
 * are written on the edit page.
 */
export function KanbanChecklistSection({
	task,
	canEdit,
	editHref,
}: {
	readonly task: KanbanTaskDetail;
	readonly canEdit: boolean;
	readonly editHref: string;
}): React.JSX.Element | null {
	const { api } = useAuth();
	const onUpdated = useKanbanItemUpdate(task.id);
	const setItem = api.kanban.setChecklistItem.useMutation({
		onSuccess: onUpdated,
		onError: (error) => {
			toastMutationError("Could not update the checklist", error, CHECKLIST_ERROR_MESSAGES);
		},
	});
	const handleToggle = React.useCallback(
		(itemId: string, isDone: boolean): void => {
			setItem.mutate({ taskId: task.id, itemId, isDone });
		},
		[setItem, task.id],
	);
	const isSubtask = task.type === "SUBTASK";
	if (!isSubtask && task.type !== "FEATURE" && task.type !== "STORY") {
		return null;
	}
	const tally = isSubtask ? task.steps : task.acceptanceCriteria;
	const isEmpty = isSubtask ? task.stepItems.length === 0 : task.acceptanceCriterionItems.length === 0;
	return (
		<KanbanPageSection
			title={isSubtask ? "Steps" : "Acceptance criteria"}
			note={`${String(tally.done)} of ${String(tally.total)} ${isSubtask ? "done" : "met"}`}
			actions={
				canEdit ? (
					<Link href={editHref} className="rounded-sm px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
						Edit list
					</Link>
				) : undefined
			}>
			{isEmpty ? (
				<p className="text-sm text-muted-foreground">
					{isSubtask ? "No steps yet. Break the subtask down on its edit page." : "No acceptance criteria yet. Add them on the edit page."}
				</p>
			) : (
				<ul className="flex flex-col">
					{isSubtask
						? task.stepItems.map((row) => (
								<ChecklistRow
									key={row.id}
									id={row.id}
									title={row.title}
									depth={row.depth}
									isDone={row.isDone}
									assignee={row.assignee}
									canEdit={canEdit}
									isPending={setItem.isPending}
									onToggle={handleToggle}
								/>
							))
						: task.acceptanceCriterionItems.map((row) => (
								<ChecklistRow
									key={row.id}
									id={row.id}
									title={row.title}
									depth={0}
									isDone={row.isDone}
									canEdit={canEdit}
									isPending={setItem.isPending}
									onToggle={handleToggle}
								/>
							))}
				</ul>
			)}
		</KanbanPageSection>
	);
}

// ── Children ──────────────────────────────────────────────────────────────────

/** One linked or child item as a row of an inline list: level, title, status, estimate, assignee. */
function ItemRow({ item, trailing }: { readonly item: KanbanItemSummary; readonly trailing?: React.ReactNode }): React.JSX.Element {
	return (
		<li className="-mx-2 flex min-h-9 flex-col gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3">
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<KanbanLevelChip type={item.type} itemKey={item.key} />
				<Link href={ROUTES.kanban.task(item.id)} className="truncate text-sm hover:underline">
					{item.title}
				</Link>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<KanbanStatusBadge column={item.column} />
				{item.storyPoints === null ? null : <KanbanPointsPill points={item.storyPoints} />}
				<KanbanAssignee person={item.assignee} compact />
				{trailing}
			</div>
		</li>
	);
}

/**
 * The items one level down (an epic's features, a feature's stories, a story's
 * tasks, a task's subtasks), with a link to them on their own board and — with CREATE — "Add …"
 * already under this item.
 */
export function KanbanChildrenSection({ task, canCreate }: { readonly task: KanbanTaskDetail; readonly canCreate: boolean }): React.JSX.Element | null {
	const { api } = useAuth();
	const childType = KANBAN_CHILD_TYPE[task.type];
	const childBoard = childType === null ? null : KANBAN_BOARD_OF_TYPE[childType];
	const [draft, setDraft] = React.useState<KanbanTaskFormValues | null>(null);
	const boardQuery = api.kanban.board.useQuery({ board: childBoard ?? "EXECUTION" }, { enabled: childBoard !== null && canCreate });
	const columns = React.useMemo((): readonly KanbanColumnHeading[] => (boardQuery.data?.data.columns ?? []).map(columnHeadingOf), [boardQuery.data]);
	const firstColumnId = columns.at(LIST_SLOT_INDEX.first)?.id;
	const handleAdd = React.useCallback((): void => {
		if (childType !== null && firstColumnId !== undefined) {
			setDraft(emptyTaskFormValues({ columnId: firstColumnId, type: childType, parentId: task.id }));
		}
	}, [childType, firstColumnId, task.id]);
	const handleClose = React.useCallback((): void => {
		setDraft(null);
	}, []);
	if (childType === null || childBoard === null) {
		return null;
	}
	const display = KANBAN_TYPE_DISPLAY[childType];
	return (
		<KanbanPageSection
			title={display.plural}
			note={`${String(task.rollup.children.done)} of ${String(task.rollup.children.total)} done`}
			actions={
				<Link
					href={kanbanBoardHref(childBoard, task.title)}
					className="rounded-sm px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
					Open the {childBoard === "PLANNING" ? "planning" : "execution"} board
				</Link>
			}>
			{task.children.length === 0 ? <p className="text-sm text-muted-foreground">No {display.plural.toLowerCase()} yet.</p> : null}
			{task.children.length === 0 && !canCreate ? null : (
				<ul className="flex flex-col">
					{task.children.map((child) => (
						<ItemRow key={child.id} item={child} />
					))}
					{canCreate ? (
						<li className="-mx-2">
							<Button variant="ghost" size="sm" className="text-muted-foreground" disabled={firstColumnId === undefined} onClick={handleAdd}>
								<Plus data-icon="inline-start" />
								Add {display.label.toLowerCase()}
							</Button>
						</li>
					) : null}
				</ul>
			)}
			<CreateKanbanTaskDialog draft={draft} board={childBoard} columns={columns} parentLabel={task.title} onClose={handleClose} />
		</KanbanPageSection>
	);
}

// ── Links ─────────────────────────────────────────────────────────────────────

function linkKindLabel(kind: KanbanLinkKind): string {
	return KANBAN_LINK_KIND_LABEL[kind];
}

interface LinkRowProps {
	readonly link: KanbanLink;
	readonly canEdit: boolean;
	readonly isPending: boolean;
	readonly onRemove: (linkId: string) => void;
}

function LinkRow({ link, canEdit, isPending, onRemove }: LinkRowProps): React.JSX.Element {
	const handleRemove = React.useCallback((): void => {
		onRemove(link.id);
	}, [link.id, onRemove]);
	return (
		<ItemRow
			item={link.item}
			trailing={
				canEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label={`Remove the link to ${link.item.title}`} disabled={isPending} onClick={handleRemove}>
						<Unlink />
					</Button>
				) : null
			}
		/>
	);
}

/**
 * The items this one blocks, is blocked by, or relates to — across both boards
 * — grouped by kind, and (with UPDATE) a picker to add one.
 */
export function KanbanLinksSection({ task, canEdit }: { readonly task: KanbanTaskDetail; readonly canEdit: boolean }): React.JSX.Element {
	const { api } = useAuth();
	const onUpdated = useKanbanItemUpdate(task.id);
	const [kind, setKind] = React.useState<KanbanLinkKind>("RELATES_TO");
	const [targetId, setTargetId] = React.useState("");
	const addLink = api.kanban.addLink.useMutation({
		onSuccess: async (response) => {
			setTargetId("");
			await onUpdated(response);
		},
		onError: (error) => {
			toastMutationError("Could not link the items", error, LINK_ERROR_MESSAGES);
		},
	});
	const removeLink = api.kanban.removeLink.useMutation({
		onSuccess: onUpdated,
		onError: (error) => {
			toastMutationError("Could not remove the link", error, LINK_ERROR_MESSAGES);
		},
	});
	const handleAdd = React.useCallback((): void => {
		if (targetId.length > 0) {
			addLink.mutate({ taskId: task.id, targetTaskId: targetId, kind });
		}
	}, [addLink, kind, targetId, task.id]);
	const handleRemove = React.useCallback(
		(linkId: string): void => {
			removeLink.mutate({ taskId: task.id, linkId });
		},
		[removeLink, task.id],
	);
	const groups = KanbanLinkKindSchema.options
		.map((option) => ({ kind: option, links: task.links.filter((link) => link.kind === option) }))
		.filter((group) => group.links.length > 0);

	return (
		<KanbanPageSection title="Linked items">
			<div className="flex flex-col gap-4">
				{groups.length === 0 ? <p className="text-sm text-muted-foreground">Not linked to anything yet.</p> : null}
				{groups.map((group) => (
					<div key={group.kind} className="flex flex-col gap-0.5">
						<h3 className="text-sm text-muted-foreground">{KANBAN_LINK_KIND_LABEL[group.kind]}</h3>
						<ul className="flex flex-col">
							{group.links.map((link) => (
								<LinkRow key={link.id} link={link} canEdit={canEdit} isPending={removeLink.isPending} onRemove={handleRemove} />
							))}
						</ul>
					</div>
				))}
				{canEdit ? (
					<div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
						<OptionSelectField id="kanban-link-kind" label="This item" value={kind} options={KanbanLinkKindSchema.options} labelOf={linkKindLabel} onChange={setKind} />
						{/* The same label and spacing as the select's field shell, so the row lines up. */}
						<div className="min-w-0 space-y-1.5">
							<Label htmlFor="kanban-link-target">Item</Label>
							<KanbanItemPicker
								id="kanban-link-target"
								value={targetId}
								onChange={setTargetId}
								types={KanbanItemTypeSchema.options}
								excludeId={task.id}
								placeholder="Search any item…"
							/>
						</div>
						<Button variant="outline" disabled={targetId.length === 0 || addLink.isPending} onClick={handleAdd}>
							<Plus data-icon="inline-start" />
							Link
						</Button>
					</div>
				) : null}
			</div>
		</KanbanPageSection>
	);
}

// ── Activity ──────────────────────────────────────────────────────────────────

/** The item's history on a timeline, newest first, a page at a time: who did what, when. */
function ActivityEntries({ taskId }: { readonly taskId: string }): React.JSX.Element {
	const { api } = useAuth();
	const [page, setPage] = React.useState(1);
	// Read once per render of the list: what "3 hours ago" counts from.
	const [now] = React.useState(Date.now);
	const query = api.kanban.activity.useQuery({ taskId, page, limit: ACTIVITY_PAGE_SIZE });
	const entries = query.data?.data ?? [];
	const handlePrevious = React.useCallback((): void => {
		setPage((current) => Math.max(1, current - 1));
	}, []);
	const handleNext = React.useCallback((): void => {
		setPage((current) => current + 1);
	}, []);
	return (
		<div className="flex max-w-4xl flex-col gap-3 pt-1">
			{query.isError ? <p className="text-sm text-destructive">Could not load the history.</p> : null}
			{!query.isError && !query.isLoading && entries.length === 0 ? <p className="text-sm text-muted-foreground">Nothing has happened yet.</p> : null}
			{entries.length === 0 ? null : (
				<KanbanPersonTimeline label="History" count={entries.length}>
					{entries.map((entry, index) => (
						<KanbanPersonTimelineItem key={entry.id} step={index + 1} person={entry.actor}>
							<p className="min-h-8 pt-1 text-sm leading-6 [overflow-wrap:anywhere]">
								<span className="font-medium">{entry.actor.name}</span> <span className="text-foreground/80">{describeActivity(entry)}</span>
							</p>
							<TimelineDate dateTime={new Date(entry.createdAt).toISOString()} title={formatDateTime(entry.createdAt)} className="mb-0">
								{formatRelativeTime(entry.createdAt, now)}
							</TimelineDate>
						</KanbanPersonTimelineItem>
					))}
				</KanbanPersonTimeline>
			)}
			{readPaginatedTotalPages(query.data?.meta) > 1 ? (
				<ListPager
					page={page}
					totalPages={readPaginatedTotalPages(query.data?.meta)}
					hasPrevious={readPaginatedHasPrevious(query.data?.meta)}
					hasNext={readPaginatedHasNext(query.data?.meta)}
					onPrevious={handlePrevious}
					onNext={handleNext}
					disabled={query.isFetching}
				/>
			) : null}
		</div>
	);
}

/** The item's history as a folded toggle at the foot of the page; it loads when opened. */
export function KanbanActivitySection({ taskId }: { readonly taskId: string }): React.JSX.Element {
	const [isOpen, setIsOpen] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setIsOpen((open) => !open);
	}, []);
	const panelId = React.useId();
	return (
		<section aria-label="History" className="flex flex-col gap-2">
			<button
				type="button"
				aria-expanded={isOpen}
				aria-controls={panelId}
				onClick={toggle}
				className="-mx-2 flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-base font-medium transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
				<ChevronRight aria-hidden className={cn("size-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-90")} />
				History
			</button>
			<div id={panelId}>{isOpen ? <ActivityEntries taskId={taskId} /> : null}</div>
		</section>
	);
}
