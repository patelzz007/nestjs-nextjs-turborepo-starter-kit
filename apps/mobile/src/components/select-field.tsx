// A labelled dropdown: the field shows the chosen option; pressing it opens a
// sheet listing every option, with an optional search box that filters them
// (a combobox, for long lists). Generic over the option value, controlled and
// data-agnostic: `value` in, `onChange(next)` out — the caller owns the
// options and the choice. Opening, closing and the search text are the
// field's own display state; the search starts empty every time it opens.

import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import * as React from "react";
import { FlatList, Pressable, Text, TextInput, View, type ListRenderItemInfo } from "react-native";

import { BottomSheet, SheetOptionRow } from "./bottom-sheet";
import { Icon } from "./icon";
import { Label, MutedText } from "./text";

export interface SelectOption<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
	/** A second line under the label ("Your repository · pushed 2 days ago"). */
	readonly description?: string;
}

export interface SelectFieldProps<TValue extends string> {
	/** Visible label, the sheet's title and the field's accessible name. */
	readonly label: string;
	readonly options: readonly SelectOption<TValue>[];
	readonly value: TValue;
	readonly onChange: (value: TValue) => void;
	/** Show a search box that filters the options by label and description. */
	readonly searchable?: boolean;
	readonly searchPlaceholder?: string;
	/** Shown when the search matches nothing. */
	readonly noMatchesMessage?: string;
	readonly disabled?: boolean;
	readonly testID?: string;
}

/** The options whose label or description contains `query` (case-insensitive); all of them for an empty query. */
export function filterSelectOptions<TValue extends string>(options: readonly SelectOption<TValue>[], query: string): readonly SelectOption<TValue>[] {
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) {
		return options;
	}
	return options.filter(
		(option: SelectOption<TValue>): boolean => option.label.toLowerCase().includes(needle) || (option.description?.toLowerCase().includes(needle) ?? false),
	);
}

export function SelectField<TValue extends string>({
	label,
	options,
	value,
	onChange,
	searchable = false,
	searchPlaceholder = "Search",
	noMatchesMessage = "Nothing matches your search.",
	disabled = false,
	testID,
}: SelectFieldProps<TValue>): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const selected = options.find((option: SelectOption<TValue>): boolean => option.value === value);
	const shown = React.useMemo(() => filterSelectOptions(options, query), [options, query]);

	const openSheet = React.useCallback((): void => {
		setQuery("");
		setOpen(true);
	}, []);
	const closeSheet = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const choose = React.useCallback(
		(next: TValue): void => {
			setOpen(false);
			if (next !== value) {
				onChange(next);
			}
		},
		[onChange, value],
	);
	const renderOption = React.useCallback(
		({ item }: ListRenderItemInfo<SelectOption<TValue>>): React.JSX.Element => (
			<SheetOptionRow value={item.value} label={item.label} description={item.description} selected={item.value === value} onSelect={choose} />
		),
		[choose, value],
	);
	const keyOf = React.useCallback((option: SelectOption<TValue>): string => option.value, []);

	return (
		<View className="gap-1.5">
			<Label>{label}</Label>
			<Pressable
				accessibilityRole="combobox"
				accessibilityLabel={`${label}, ${selected?.label ?? "none selected"}`}
				accessibilityHint="Opens the list of options"
				accessibilityState={{ expanded: open, disabled }}
				disabled={disabled}
				onPress={openSheet}
				testID={testID}
				className="min-h-12 flex-row items-center gap-3 rounded-xl border border-input bg-card px-3.5 py-2.5 active:opacity-70">
				<View className="flex-1 gap-0.5">
					<Text className="font-sans text-base text-foreground" numberOfLines={1}>
						{selected?.label ?? ""}
					</Text>
					{selected?.description === undefined ? null : (
						<Text className="font-sans text-xs text-muted-foreground" numberOfLines={1}>
							{selected.description}
						</Text>
					)}
				</View>
				<Icon icon={ChevronDownIcon} size="md" colorClassName="accent-muted-foreground" />
			</Pressable>

			{/* The options are their own (virtualized) scroll, under a search box that stays put. */}
			<BottomSheet visible={open} title={label} onClose={closeSheet} scrollsItself>
				{searchable ? (
					<TextInput
						accessibilityLabel={`Search ${label.toLowerCase()}`}
						value={query}
						onChangeText={setQuery}
						placeholder={searchPlaceholder}
						placeholderTextColorClassName="accent-muted-foreground"
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="search"
						className="min-h-11 rounded-xl border border-input bg-card px-3.5 py-2.5 font-sans text-base text-foreground"
					/>
				) : null}
				<FlatList
					data={shown}
					keyExtractor={keyOf}
					renderItem={renderOption}
					keyboardShouldPersistTaps="handled"
					ListEmptyComponent={<MutedText>{noMatchesMessage}</MutedText>}
				/>
			</BottomSheet>
		</View>
	);
}
