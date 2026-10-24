"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	KanbanTaskPrioritySchema,
	KanbanTeamSchema,
	type Envelope,
	type KanbanTaskDetail,
	type KanbanTaskPriority,
	type KanbanTeam,
	type UpdateKanbanTaskInput,
} from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { toastMessage } from "@workspace/ui/components/toast";
import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { invalidateKanban } from "../lib/kanban-cache";
import { effectiveSchedule, formatDateRange, KANBAN_PRIORITY_DISPLAY, KANBAN_TEAM_DISPLAY, KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import { followsStoryDates, KanbanTaskEditFormSchema, toTaskEditFormValues } from "../lib/kanban-task-form";
import { KanbanCriteriaEditor, KanbanStepEditor } from "./kanban-checklist-editor";
import { KanbanAssigneeField, KanbanDateField, KanbanStoryPointsField } from "./kanban-form-fields";
import { useKanbanPeople } from "./kanban-pickers";
import { KanbanLevelChip, KanbanTypeBadge } from "./kanban-task-badges";
import { KanbanTaskDetailSkeleton } from "./kanban-task-detail-view";

/** What `PATCH /admin/kanban/tasks/:taskId` can refuse, in words. */
const UPDATE_TASK_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_TASK_STALE: "Someone else changed this item while you were editing. Reload the page to edit the latest version.",
	KANBAN_PARENT_INVALID: "Choose a parent one level up.",
	KANBAN_ASSIGNEE_INVALID: "Someone you assigned cannot use the board.",
	KANBAN_ITEM_RULE_VIOLATED: "The item breaks a rule of its level.",
	KANBAN_CHECKLIST_ITEM_NOT_FOUND: "A checklist row was removed meanwhile. Reload the page and try again.",
};

function priorityLabel(priority: KanbanTaskPriority): string {
	return KANBAN_PRIORITY_DISPLAY[priority].label;
}

function teamLabel(team: KanbanTeam): string {
	return KANBAN_TEAM_DISPLAY[team].label;
}

function selectIsSubmitting(state: { readonly isSubmitting: boolean }): boolean {
	return state.isSubmitting;
}

function EditKanbanTaskForm({ task }: { readonly task: KanbanTaskDetail }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();
	const people = useKanbanPeople();
	const typeDisplay = KANBAN_TYPE_DISPLAY[task.type];
	const parent = task.ancestors.at(task.ancestors.length - 1);
	const inherited = effectiveSchedule(task);

	const updateTask = api.kanban.updateTask.useMutation({
		onSuccess: async (response) => {
			// The old and the new parent both list their children.
			await invalidateKanban(queryClient, [task.id, task.parentId, response.data.parentId]);
			toastMessage.success({ title: `${typeDisplay.label} saved`, description: response.data.title });
			router.push(ROUTES.kanban.task(task.id));
		},
		onError: (error) => {
			toastMutationError(`Could not save the ${typeDisplay.label.toLowerCase()}`, error, UPDATE_TASK_ERROR_MESSAGES);
		},
	});
	const form = useForm({
		defaultValues: toTaskEditFormValues(task),
		validators: { onSubmit: KanbanTaskEditFormSchema },
		onSubmit: ({ value }): void => {
			// The version the form was loaded at travels in the values: the API refuses the write if the item changed since.
			const input: UpdateKanbanTaskInput = KanbanTaskEditFormSchema.parse(value);
			updateTask.mutate({ taskId: task.id, ...input });
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);

	return (
		<form noValidate className="flex flex-col gap-6" onSubmit={handleFormSubmit}>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex min-w-0 flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Details</CardTitle>
							<CardDescription>What the {typeDisplay.label.toLowerCase()} is and why it matters.</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-5">
							<form.Field name="title">
								{(field) => (
									<TextField
										id="kanban-edit-title"
										label="Title"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
									/>
								)}
							</form.Field>
							<form.Field name="description">
								{(field) => (
									<TextField
										id="kanban-edit-description"
										label="Description"
										multiline
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
									/>
								)}
							</form.Field>
							<form.Field name="labels">
								{(field) => (
									<TextField
										id="kanban-edit-labels"
										label="Labels (comma-separated)"
										placeholder="payments, q4"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
									/>
								)}
							</form.Field>
						</CardContent>
					</Card>

					{task.type === "SUBTASK" ? (
						<Card>
							<CardHeader>
								<CardTitle>Steps</CardTitle>
								<CardDescription>Break the subtask down: sub-subtasks and sub-sub-subtasks.</CardDescription>
							</CardHeader>
							<CardContent>
								<form.Field name="steps">{(field) => <KanbanStepEditor rows={field.state.value} onChange={field.handleChange} people={people} />}</form.Field>
							</CardContent>
						</Card>
					) : null}
					{task.type === "FEATURE" || task.type === "STORY" ? (
						<Card>
							<CardHeader>
								<CardTitle>Acceptance criteria</CardTitle>
								<CardDescription>What must be true for this {typeDisplay.label.toLowerCase()} to be done.</CardDescription>
							</CardHeader>
							<CardContent>
								<form.Field name="acceptanceCriteria">{(field) => <KanbanCriteriaEditor rows={field.state.value} onChange={field.handleChange} />}</form.Field>
							</CardContent>
						</Card>
					) : null}
				</div>

				<div className="flex min-w-0 flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Planning</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{task.type === "EPIC" ? null : (
								<div className="flex flex-col gap-1.5">
									<span className="text-sm font-medium">Parent</span>
									{parent === undefined ? (
										<span className="text-sm text-muted-foreground">None</span>
									) : (
										<span className="flex min-w-0 items-center gap-2 text-sm">
											<KanbanLevelChip type={parent.type} itemKey={parent.key} />
											<span className="truncate">{parent.title}</span>
										</span>
									)}
									<span className="text-xs text-muted-foreground">To change it, use Move to… on the item&apos;s page.</span>
								</div>
							)}
							<form.Field name="assigneeId">
								{(field) => (
									<KanbanAssigneeField
										id="kanban-edit-assignee"
										value={field.state.value}
										onChange={field.handleChange}
										people={people}
										current={task.assignee}
										errors={field.state.meta.errors}
									/>
								)}
							</form.Field>
							<form.Field name="priority">
								{(field) => (
									<OptionSelectField
										id="kanban-edit-priority"
										label="Priority"
										value={field.state.value}
										options={KanbanTaskPrioritySchema.options}
										labelOf={priorityLabel}
										onChange={field.handleChange}
									/>
								)}
							</form.Field>
							<form.Field name="team">
								{(field) => (
									<OptionSelectField
										id="kanban-edit-team"
										label="Team"
										value={field.state.value}
										options={KanbanTeamSchema.options}
										labelOf={teamLabel}
										onChange={field.handleChange}
									/>
								)}
							</form.Field>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Schedule and estimate</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{followsStoryDates(task.type) ? (
								<p className="flex items-start gap-2 text-sm text-muted-foreground">
									<CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0" />
									<span>Follows its story&apos;s dates: {formatDateRange(inherited.startAt, inherited.dueAt)}.</span>
								</p>
							) : (
								<>
									<form.Field name="startAt">
										{(field) => (
											<KanbanDateField id="kanban-edit-start" label="Start date" value={field.state.value} onChange={field.handleChange} errors={field.state.meta.errors} />
										)}
									</form.Field>
									<form.Field name="dueAt">
										{(field) => (
											<KanbanDateField id="kanban-edit-due" label="Due date" value={field.state.value} onChange={field.handleChange} errors={field.state.meta.errors} />
										)}
									</form.Field>
								</>
							)}
							{task.type === "STORY" ? (
								<form.Field name="storyPoints">
									{(field) => <KanbanStoryPointsField id="kanban-edit-points" value={field.state.value} onChange={field.handleChange} errors={field.state.meta.errors} />}
								</form.Field>
							) : null}
							{task.type === "EPIC" || task.type === "FEATURE" ? (
								<p className="text-sm text-muted-foreground">
									Estimated by its stories: {task.rollup.points.total} points, {task.rollup.points.done} done.
								</p>
							) : null}
							<form.Field name="progress">
								{(field) => (
									<TextField
										id="kanban-edit-progress"
										label="Progress (%)"
										inputMode="numeric"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
									/>
								)}
							</form.Field>
						</CardContent>
					</Card>
				</div>
			</div>

			<div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
				<Link href={ROUTES.kanban.task(task.id)} className={buttonVariants({ variant: "outline" })}>
					Cancel
				</Link>
				<form.Subscribe selector={selectIsSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" disabled={isSubmitting || updateTask.isPending}>
							{updateTask.isPending ? "Saving…" : "Save changes"}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

export interface EditKanbanTaskViewProps {
	readonly taskId: string;
	readonly initialTask?: Envelope<KanbanTaskDetail> | undefined;
}

/**
 * `/components/kanban-board/tasks/[id]/edit` — edit an item: its details and
 * labels, its checklist (a subtask's steps, a feature's or story's acceptance
 * criteria), its assignee, priority and team, and its dates and estimate as its
 * level allows. Its column changes by moving it on the board, its parent by
 * Move to… on its page; its level never changes.
 */
export function EditKanbanTaskView({ taskId, initialTask }: EditKanbanTaskViewProps): React.JSX.Element {
	const { api } = useAuth();
	const taskQuery = api.kanban.task.useQuery({ taskId }, initialDataOption(initialTask));
	const task = taskQuery.data?.data;

	if (task === undefined) {
		return taskQuery.isError ? (
			<p role="alert" className="text-destructive">
				Could not load this item.
			</p>
		) : (
			<KanbanTaskDetailSkeleton />
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<Link href={ROUTES.kanban.task(task.id)} className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
					<ArrowLeft data-icon="inline-start" />
					Back to the {KANBAN_TYPE_DISPLAY[task.type].label.toLowerCase()}
				</Link>
				<div className="flex min-w-0 flex-col gap-1">
					<div className="flex items-center gap-2">
						<KanbanTypeBadge type={task.type} />
						<span className="text-sm text-muted-foreground">{task.column.title}</span>
					</div>
					<h1 className="truncate text-2xl font-semibold tracking-tight">Edit {task.title}</h1>
				</div>
			</div>
			<EditKanbanTaskForm key={`${task.id}:${String(task.version)}`} task={task} />
		</div>
	);
}
