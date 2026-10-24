"use client";

import { useForm } from "@tanstack/react-form";
import { KanbanTaskPrioritySchema, KanbanTeamSchema, type CreateKanbanTaskInput, type KanbanItemType, type KanbanTaskPriority, type KanbanTeam } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import * as React from "react";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";

import { KANBAN_PRIORITY_DISPLAY, KANBAN_TEAM_DISPLAY, KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import { followsStoryDates, KanbanTaskFormSchema, type KanbanTaskFormValues } from "../lib/kanban-task-form";
import type { KanbanColumnHeading } from "./kanban-board-columns";
import { KanbanAssigneeField, KanbanDateField, KanbanParentField, KanbanStoryPointsField } from "./kanban-form-fields";
import { useKanbanPeople } from "./kanban-pickers";

function priorityLabel(priority: KanbanTaskPriority): string {
	return KANBAN_PRIORITY_DISPLAY[priority].label;
}

function teamLabel(team: KanbanTeam): string {
	return KANBAN_TEAM_DISPLAY[team].label;
}

function typeLabel(type: KanbanItemType): string {
	return KANBAN_TYPE_DISPLAY[type].label;
}

function selectType(state: { readonly values: { readonly type: KanbanItemType } }): KanbanItemType {
	return state.values.type;
}

export interface KanbanTaskFormProps {
	readonly initialValues: KanbanTaskFormValues;
	/** The board's columns the new item may start in. */
	readonly columns: readonly KanbanColumnHeading[];
	/** The levels the board holds (the type choice). */
	readonly types: readonly KanbanItemType[];
	/** The preset parent's title ("Add story" from a feature's page). */
	readonly parentLabel?: string | undefined;
	readonly submitLabel: string;
	readonly isPending: boolean;
	/** Called with values parsed by the shared create contract. */
	readonly onSubmit: (input: CreateKanbanTaskInput) => void;
	readonly onCancel: () => void;
}

/**
 * The new-item form — TanStack Form validated with `KanbanTaskFormSchema`,
 * which converts the raw inputs and pipes into the shared `CreateKanbanTaskSchema`
 * (the API's own rules, the hierarchy's included). The fields follow the type:
 * an epic has no parent, a task needs its story and follows its dates, only a
 * story is estimated. The caller owns the mutation and what happens after it.
 */
export function KanbanTaskForm({ initialValues, columns, types, parentLabel, submitLabel, isPending, onSubmit, onCancel }: KanbanTaskFormProps): React.JSX.Element {
	const people = useKanbanPeople();
	const form = useForm({
		defaultValues: initialValues,
		validators: { onSubmit: KanbanTaskFormSchema },
		onSubmit: ({ value }): void => {
			onSubmit(KanbanTaskFormSchema.parse(value));
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);
	const columnIds = React.useMemo((): readonly string[] => columns.map((column) => column.id), [columns]);
	const columnLabel = React.useCallback((columnId: string): string => columns.find((column) => column.id === columnId)?.title ?? columnId, [columns]);

	return (
		<form noValidate className="flex flex-col gap-5" onSubmit={handleFormSubmit}>
			<div className="grid gap-4 sm:grid-cols-2">
				<form.Field name="type">
					{(field) => <OptionSelectField id="kanban-task-type" label="Type" value={field.state.value} options={types} labelOf={typeLabel} onChange={field.handleChange} />}
				</form.Field>
				<form.Field name="columnId">
					{(field) => (
						<OptionSelectField id="kanban-task-column" label="Column" value={field.state.value} options={columnIds} labelOf={columnLabel} onChange={field.handleChange} />
					)}
				</form.Field>
			</div>
			<form.Field name="title">
				{(field) => (
					<TextField id="kanban-task-title" label="Title" value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} errors={field.state.meta.errors} />
				)}
			</form.Field>
			<form.Subscribe selector={selectType}>
				{(type) => (
					<form.Field name="parentId">
						{(field) => (
							<KanbanParentField
								id="kanban-task-parent"
								type={type}
								value={field.state.value}
								onChange={field.handleChange}
								selectedLabel={parentLabel}
								errors={field.state.meta.errors}
							/>
						)}
					</form.Field>
				)}
			</form.Subscribe>
			<form.Field name="description">
				{(field) => (
					<TextField
						id="kanban-task-description"
						label="Description (optional)"
						multiline
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						errors={field.state.meta.errors}
					/>
				)}
			</form.Field>
			<div className="grid gap-4 sm:grid-cols-3">
				<form.Field name="priority">
					{(field) => (
						<OptionSelectField
							id="kanban-task-priority"
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
							id="kanban-task-team"
							label="Team"
							value={field.state.value}
							options={KanbanTeamSchema.options}
							labelOf={teamLabel}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>
				<form.Field name="assigneeId">
					{(field) => (
						<KanbanAssigneeField id="kanban-task-assignee" value={field.state.value} onChange={field.handleChange} people={people} errors={field.state.meta.errors} />
					)}
				</form.Field>
			</div>
			<form.Field name="labels">
				{(field) => (
					<TextField
						id="kanban-task-labels"
						label="Labels (comma-separated)"
						placeholder="payments, q4"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						errors={field.state.meta.errors}
					/>
				)}
			</form.Field>
			<form.Subscribe selector={selectType}>
				{(type) => (
					<div className="grid gap-4 sm:grid-cols-3">
						{followsStoryDates(type) ? (
							<p className="text-sm text-muted-foreground sm:col-span-2">A {type === "TASK" ? "task" : "subtask"} follows its story&apos;s dates.</p>
						) : (
							<>
								<form.Field name="startAt">
									{(field) => (
										<KanbanDateField id="kanban-task-start" label="Start date" value={field.state.value} onChange={field.handleChange} errors={field.state.meta.errors} />
									)}
								</form.Field>
								<form.Field name="dueAt">
									{(field) => (
										<KanbanDateField id="kanban-task-due" label="Due date" value={field.state.value} onChange={field.handleChange} errors={field.state.meta.errors} />
									)}
								</form.Field>
							</>
						)}
						{type === "STORY" ? (
							<form.Field name="storyPoints">
								{(field) => <KanbanStoryPointsField id="kanban-task-points" value={field.state.value} onChange={field.handleChange} errors={field.state.meta.errors} />}
							</form.Field>
						) : (
							<form.Field name="progress">
								{(field) => (
									<TextField
										id="kanban-task-progress"
										label="Progress (%)"
										inputMode="numeric"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
									/>
								)}
							</form.Field>
						)}
					</div>
				)}
			</form.Subscribe>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" disabled={isPending}>
					{isPending ? "Saving…" : submitLabel}
				</Button>
			</div>
		</form>
	);
}
