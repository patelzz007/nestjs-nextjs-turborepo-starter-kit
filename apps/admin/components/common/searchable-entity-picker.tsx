"use client";

import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/form/combobox";
import * as React from "react";

/** Wait for a pause in typing before asking the API. */
export const ENTITY_SEARCH_DEBOUNCE_MS = 250;

/** One pickable entity: its id and display name. */
export interface EntityOption {
	readonly id: string;
	readonly label: string;
}

export interface SearchableEntityPickerProps {
	readonly id: string;
	/** The selected id, or `""` for none. */
	readonly value: string;
	readonly onChange: (id: string) => void;
	/** The current server-side matches for the typed text. */
	readonly options: readonly EntityOption[];
	/** Label of the selected entity when it is not among `options` (e.g. a pre-filled value). */
	readonly selectedLabel: string | undefined;
	readonly onSearch: (text: string) => void;
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly placeholder: string;
	readonly emptyText: string;
	readonly errorText: string;
	readonly invalid?: boolean;
}

/**
 * Data-agnostic, server-searched picker: the caller owns the query (a capped
 * page of matches per typed text) and hands the matches in, so the picker
 * never lists a whole table and works for any entity.
 */
export function SearchableEntityPicker({
	id,
	value,
	onChange,
	options,
	selectedLabel,
	onSearch,
	isLoading,
	isError,
	placeholder,
	emptyText,
	errorText,
	invalid = false,
}: SearchableEntityPickerProps): React.JSX.Element {
	const labelOf = React.useCallback(
		(entityId: string): string => options.find((option) => option.id === entityId)?.label ?? (entityId === value ? (selectedLabel ?? "") : ""),
		[options, selectedLabel, value],
	);

	const handleValueChange = React.useCallback(
		(next: string | null): void => {
			onChange(next ?? "");
		},
		[onChange],
	);

	return (
		<Combobox<string>
			value={value.length > 0 ? value : null}
			onValueChange={handleValueChange}
			itemToStringLabel={labelOf}
			filter={null}
			debounceMs={ENTITY_SEARCH_DEBOUNCE_MS}
			onInputValueChange={onSearch}
			loading={isLoading}
			invalid={invalid}>
			<ComboboxInput id={id} showClear placeholder={placeholder} />
			<ComboboxContent>
				<ComboboxList>
					{options.map((option) => (
						<ComboboxItem key={option.id} value={option.id}>
							{option.label}
						</ComboboxItem>
					))}
					{!isLoading && options.length === 0 ? <ComboboxEmpty text={isError ? errorText : emptyText} /> : null}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

/** The trimmed search text, or `undefined` for an empty box (no `search` param). */
export function toSearchParam(text: string): string | undefined {
	const trimmed = text.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
