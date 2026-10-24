"use client";

import { KANBAN_PARENT_TYPE, KANBAN_STORY_POINT_OPTIONS, type KanbanItemType, type KanbanPerson } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { FieldError } from "@workspace/ui/components/field";
import { Label } from "@workspace/ui/components/label";
import * as React from "react";

import { OptionSelectField, type FormFieldError } from "@/components/common/form-fields";

import { KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import { KanbanAssigneeSelect, KanbanItemPicker } from "./kanban-pickers";

// The item forms' own controlled fields (create dialog and edit page), built
// on the admin's common fields: a TanStack Form field passes its value,
// `handleChange` and errors, never an inline handler.

export interface KanbanDateFieldProps {
	readonly id: string;
	readonly label: string;
	/** `yyyy-MM-dd`, or `""` for none. */
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly errors?: readonly FormFieldError[] | undefined;
}

/** A date picker and a button that clears the date. */
export function KanbanDateField({ id, label, value, onChange, errors = [] }: KanbanDateFieldProps): React.JSX.Element {
	const handleClear = React.useCallback((): void => {
		onChange("");
	}, [onChange]);
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>{label}</Label>
			<div className="flex items-center gap-2">
				<DatePicker id={id} value={value} onValueChange={onChange} placeholder="No date" className="flex-1" />
				{value.length > 0 ? (
					<Button type="button" variant="ghost" size="sm" onClick={handleClear}>
						Clear
					</Button>
				) : null}
			</div>
			<FieldError errors={[...errors]} />
		</div>
	);
}

/** The select value meaning "not estimated". */
const NOT_ESTIMATED = "NONE";
const POINT_CHOICES: readonly string[] = [NOT_ESTIMATED, ...KANBAN_STORY_POINT_OPTIONS.map(String)];

function pointsChoiceLabel(choice: string): string {
	return choice === NOT_ESTIMATED ? "Not estimated" : `${choice} points`;
}

export interface KanbanStoryPointsFieldProps {
	readonly id: string;
	/** The estimate as text, `""` for none. */
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly errors?: readonly FormFieldError[] | undefined;
}

/** A story's estimate, on the Fibonacci scale. */
export function KanbanStoryPointsField({ id, value, onChange, errors = [] }: KanbanStoryPointsFieldProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(choice: string): void => {
			onChange(choice === NOT_ESTIMATED ? "" : choice);
		},
		[onChange],
	);
	return (
		<OptionSelectField
			id={id}
			label="Story points"
			value={value.length === 0 ? NOT_ESTIMATED : value}
			options={POINT_CHOICES}
			labelOf={pointsChoiceLabel}
			onChange={handleChange}
			errors={errors}
		/>
	);
}

export interface KanbanAssigneeFieldProps {
	readonly id: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly people: readonly KanbanPerson[];
	readonly current?: KanbanPerson | null | undefined;
	readonly errors?: readonly FormFieldError[] | undefined;
}

export function KanbanAssigneeField({ id, value, onChange, people, current, errors = [] }: KanbanAssigneeFieldProps): React.JSX.Element {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>Assignee</Label>
			<KanbanAssigneeSelect id={id} value={value} onChange={onChange} people={people} current={current} />
			<FieldError errors={[...errors]} />
		</div>
	);
}

export interface KanbanParentFieldProps {
	readonly id: string;
	/** The item's level: decides the parent's level, and whether one is required (a task's story). */
	readonly type: KanbanItemType;
	readonly value: string;
	readonly onChange: (value: string) => void;
	/** The stored parent's title, shown before any search. */
	readonly selectedLabel?: string | undefined;
	readonly excludeId?: string | undefined;
	readonly errors?: readonly FormFieldError[] | undefined;
}

/** The item one level up — nothing for an epic. */
export function KanbanParentField({ id, type, value, onChange, selectedLabel, excludeId, errors = [] }: KanbanParentFieldProps): React.JSX.Element | null {
	const parentType = KANBAN_PARENT_TYPE[type];
	const parentTypes = React.useMemo((): readonly KanbanItemType[] => (parentType === null ? [] : [parentType]), [parentType]);
	if (parentType === null) {
		return null;
	}
	const parentLabel = KANBAN_TYPE_DISPLAY[parentType].label;
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>
				{parentLabel}
				{type === "TASK" || type === "SUBTASK" ? null : <span className="font-normal text-muted-foreground"> (optional)</span>}
			</Label>
			<KanbanItemPicker
				id={id}
				value={value}
				onChange={onChange}
				types={parentTypes}
				selectedLabel={selectedLabel}
				excludeId={excludeId}
				placeholder={`Search ${KANBAN_TYPE_DISPLAY[parentType].plural.toLowerCase()}…`}
				invalid={errors.length > 0}
			/>
			<FieldError errors={[...errors]} />
		</div>
	);
}
