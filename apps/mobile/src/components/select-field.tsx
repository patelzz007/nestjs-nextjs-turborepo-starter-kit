// A labelled dropdown: the field shows the chosen option; pressing it opens a
// sheet listing every option, with an optional search box that filters them
// (a combobox, for long lists). Generic over the option value, controlled and
// data-agnostic: `value` in, `onChange(next)` out — the caller owns the
// options and the choice. Opening, closing and the search text are the
// field's own display state; the search starts empty every time it opens.

import CheckIcon from "lucide-react-native/icons/check";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View, type ListRenderItemInfo } from "react-native";

import { Icon } from "./icon";
import { Label, MutedText, Subheading } from "./text";

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

/** iOS lifts the sheet above the keyboard by padding; Android resizes the window itself. */
const KEYBOARD_BEHAVIOR = Platform.OS === "ios" ? "padding" : undefined;

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
		({ item }: ListRenderItemInfo<SelectOption<TValue>>): React.JSX.Element => <SelectOptionRow option={item} selected={item.value === value} onSelect={choose} />,
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

			<Modal visible={open} transparent animationType="slide" onRequestClose={closeSheet}>
				<KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} className="flex-1 justify-end">
					<Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closeSheet} className="absolute inset-0 bg-scrim opacity-50" />
					<View accessibilityViewIsModal className="max-h-[80%] gap-3 rounded-t-2xl border border-border bg-popover px-4 pt-4 pb-8">
						<View className="flex-row items-center justify-between">
							<Subheading>{label}</Subheading>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`Close ${label.toLowerCase()}`}
								onPress={closeSheet}
								hitSlop={8}
								className="size-11 items-center justify-center rounded-full active:opacity-60">
								<Icon icon={XIcon} size="md" colorClassName="accent-muted-foreground" />
							</Pressable>
						</View>
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
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</View>
	);
}

interface SelectOptionRowProps<TValue extends string> {
	readonly option: SelectOption<TValue>;
	readonly selected: boolean;
	readonly onSelect: (value: TValue) => void;
}

function SelectOptionRow<TValue extends string>({ option, selected, onSelect }: SelectOptionRowProps<TValue>): React.JSX.Element {
	const select = React.useCallback((): void => {
		onSelect(option.value);
	}, [onSelect, option.value]);
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={option.label}
			accessibilityHint={option.description}
			accessibilityState={{ checked: selected }}
			onPress={select}
			className="min-h-12 flex-row items-center gap-3 border-b border-border py-3 active:opacity-70">
			<View className="flex-1 gap-0.5">
				<Text className={`text-base text-foreground ${selected ? "font-sans-semibold" : "font-sans"}`}>{option.label}</Text>
				{option.description === undefined ? null : <Text className="font-sans text-sm text-muted-foreground">{option.description}</Text>}
			</View>
			{selected ? <Icon icon={CheckIcon} size="md" colorClassName="accent-primary" /> : null}
		</Pressable>
	);
}
