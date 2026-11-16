// A search-first picker for a long list (a country, a repository): the field
// shows the chosen option or a placeholder; pressing it opens a sheet whose
// search box is focused at once and filters the options as you type (the web
// kit's `Combobox` / `Command`, as a sheet on a phone). Generic over the
// option value, controlled and data-agnostic: `value` in, `onChange(next)`
// out. Whether the sheet is open and the search text are display state; the
// search starts empty every time it opens.
//
// It is `SelectField` with the search always on and focused, and (unless the
// caller passes another glyph) a search glyph in the field: one
// implementation (and one `filterSelectOptions`), so both pickers behave
// alike. `MultiCombobox` is the same over `MultiSelectField`.

import SearchIcon from "lucide-react-native/icons/search";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { MultiSelectField, type MultiSelectFieldProps, SelectField, selectFieldVariants, type SelectFieldProps, type SelectOption } from "./select-field";

/** The option type is `SelectField`'s: a combobox takes the same lists. */
export type ComboboxOption<TValue extends string> = SelectOption<TValue>;

/** The field's layout (label, trigger, messages) — `SelectField`'s. */
export const comboboxVariants = selectFieldVariants;

/** `SelectField`'s props, less the ones a combobox fixes: the search is always shown and focused. The field's glyph defaults to a search glyph. */
export type ComboboxProps<TValue extends string> = Omit<SelectFieldProps<TValue>, "searchable" | "autoFocusSearch">;

/** `Combobox` keeps its option type through `memo` and `forwardRef`. The ref reaches the trigger. */
export interface ComboboxComponent {
	<TValue extends string>(props: ComboboxProps<TValue> & React.RefAttributes<ViewInstance>): React.ReactNode;
	displayName?: string | undefined;
}

export const Combobox: ComboboxComponent = React.memo(
	React.forwardRef(function Combobox(
		{ placeholder = "Select an option", accessibilityHint = "Opens a search of the options", leadingIcon = SearchIcon, ...props }: ComboboxProps<string>,
		ref: React.ForwardedRef<ViewInstance>,
	): React.JSX.Element {
		return <SelectField ref={ref} {...props} placeholder={placeholder} accessibilityHint={accessibilityHint} searchable autoFocusSearch leadingIcon={leadingIcon} />;
	}),
);

/** `MultiSelectField`'s props, less the ones a combobox fixes. */
export type MultiComboboxProps<TValue extends string> = Omit<MultiSelectFieldProps<TValue>, "searchable" | "autoFocusSearch">;

/** `MultiCombobox` keeps its option type through `memo` and `forwardRef`. The ref reaches the trigger. */
export interface MultiComboboxComponent {
	<TValue extends string>(props: MultiComboboxProps<TValue> & React.RefAttributes<ViewInstance>): React.ReactNode;
	displayName?: string | undefined;
}

/** A search-first picker of several options: `MultiSelectField` with the search always shown and focused. */
export const MultiCombobox: MultiComboboxComponent = React.memo(
	React.forwardRef(function MultiCombobox(
		{ placeholder = "Select options", accessibilityHint = "Opens a search of the options", leadingIcon = SearchIcon, ...props }: MultiComboboxProps<string>,
		ref: React.ForwardedRef<ViewInstance>,
	): React.JSX.Element {
		return <MultiSelectField ref={ref} {...props} placeholder={placeholder} accessibilityHint={accessibilityHint} searchable autoFocusSearch leadingIcon={leadingIcon} />;
	}),
);
