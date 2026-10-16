// A search-first picker for a long list (a country, a repository): the field
// shows the chosen option or a placeholder; pressing it opens a sheet whose
// search box is focused at once and filters the options as you type (the web
// kit's `Combobox` / `Command`, as a sheet on a phone). Generic over the
// option value, controlled and data-agnostic: `value` in, `onChange(next)`
// out. Whether the sheet is open and the search text are display state; the
// search starts empty every time it opens.
//
// It is `SelectField` with the search always on and focused, and a search
// glyph in the field: one implementation (and one `filterSelectOptions`), so
// both pickers behave alike.

import SearchIcon from "lucide-react-native/icons/search";
import * as React from "react";
import type { View } from "react-native";

import { SelectField, selectFieldVariants, type SelectFieldProps, type SelectOption } from "./select-field";

/** The option type is `SelectField`'s: a combobox takes the same lists. */
export type ComboboxOption<TValue extends string> = SelectOption<TValue>;

/** The field's layout (label, trigger, messages) — `SelectField`'s. */
export const comboboxVariants = selectFieldVariants;

/** `SelectField`'s props, less the ones a combobox fixes: the search is always shown, focused, behind a search glyph. */
export type ComboboxProps<TValue extends string> = Omit<SelectFieldProps<TValue>, "searchable" | "autoFocusSearch" | "leadingIcon">;

/** `Combobox` keeps its option type through `memo` and `forwardRef`. The ref reaches the trigger. */
export interface ComboboxComponent {
	<TValue extends string>(props: ComboboxProps<TValue> & React.RefAttributes<View>): React.ReactNode;
	displayName?: string | undefined;
}

export const Combobox: ComboboxComponent = React.memo(
	React.forwardRef(function Combobox(
		{ placeholder = "Select an option", accessibilityHint = "Opens a search of the options", ...props }: ComboboxProps<string>,
		ref: React.ForwardedRef<View>,
	): React.JSX.Element {
		return <SelectField ref={ref} {...props} placeholder={placeholder} accessibilityHint={accessibilityHint} searchable autoFocusSearch leadingIcon={SearchIcon} />;
	}),
);
