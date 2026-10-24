"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { KanbanItemType, KanbanPerson } from "@workspace/shared";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import * as React from "react";

import { SearchableEntityPicker, toSearchParam, type EntityOption } from "@/components/common/searchable-entity-picker";

/** Matches a picker offers per search — it narrows by typing, it never lists a whole board. */
export const KANBAN_PICKER_RESULT_LIMIT = 20;

/** The select value meaning "nobody". */
export const UNASSIGNED = "UNASSIGNED";

export interface KanbanItemPickerProps {
	readonly id: string;
	/** The chosen item's id, or `""` for none. */
	readonly value: string;
	readonly onChange: (itemId: string) => void;
	/** The levels it offers (a story's parent: features; a link: any). */
	readonly types: readonly KanbanItemType[];
	/** The chosen item's title when it is not among the current matches (a stored parent). */
	readonly selectedLabel?: string | undefined;
	/** An item never offered (the item being edited, so it cannot link to itself). */
	readonly excludeId?: string | undefined;
	readonly placeholder: string;
	readonly invalid?: boolean;
}

/**
 * Searches live items of the given levels by title (`GET /admin/kanban/items`,
 * capped matches) for a parent or a link.
 */
export function KanbanItemPicker({ id, value, onChange, types, selectedLabel, excludeId, placeholder, invalid = false }: KanbanItemPickerProps): React.JSX.Element {
	const { api } = useAuth();
	const [search, setSearch] = React.useState("");
	const query = api.kanban.items.useQuery({ page: 1, limit: KANBAN_PICKER_RESULT_LIMIT, filter: { type: { in: [...types] } }, search: toSearchParam(search) });
	const items = query.data?.data;
	const options = React.useMemo(
		(): readonly EntityOption[] =>
			// The plain title, exactly as `selectedLabel` names the stored item: one label per item, so the
			// input's text never swaps between two spellings as the matches reload.
			(items ?? []).filter((item) => item.id !== excludeId).map((item) => ({ id: item.id, label: item.title })),
		[excludeId, items],
	);
	return (
		<SearchableEntityPicker
			id={id}
			value={value}
			onChange={onChange}
			options={options}
			selectedLabel={selectedLabel}
			onSearch={setSearch}
			isLoading={query.isFetching}
			isError={query.isError}
			placeholder={placeholder}
			emptyText="No matching items"
			errorText="Couldn't load items"
			invalid={invalid}
		/>
	);
}

/** Everyone an item can be assigned to (`GET /admin/kanban/people`), by name; empty while it loads. */
export function useKanbanPeople(): readonly KanbanPerson[] {
	const { api } = useAuth();
	const query = api.kanban.people.useQuery(undefined);
	return query.data?.data.people ?? [];
}

export interface KanbanAssigneeSelectProps {
	readonly id: string;
	/** The assignee's id, or `""` for unassigned. */
	readonly value: string;
	readonly onChange: (userId: string) => void;
	readonly people: readonly KanbanPerson[];
	/** The stored assignee, kept as an option when they are no longer assignable. */
	readonly current?: KanbanPerson | null | undefined;
	readonly ariaLabel?: string | undefined;
}

/** A select over the assignable people, "Unassigned" first. */
export function KanbanAssigneeSelect({ id, value, onChange, people, current, ariaLabel }: KanbanAssigneeSelectProps): React.JSX.Element {
	const options = React.useMemo((): readonly SelectOption<string>[] => {
		const listed = current === null || current === undefined || people.some((person) => person.id === current.id) ? people : [current, ...people];
		return [{ value: UNASSIGNED, label: "Unassigned" }, ...listed.map((person): SelectOption<string> => ({ value: person.id, label: person.name }))];
	}, [current, people]);
	const handleValueChange = React.useCallback(
		(next: string | null): void => {
			onChange(next === null || next === UNASSIGNED ? "" : next);
		},
		[onChange],
	);
	return (
		<Select items={options} value={value.length === 0 ? UNASSIGNED : value} onValueChange={handleValueChange}>
			<SelectTrigger id={id} className="w-full" aria-label={ariaLabel}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
