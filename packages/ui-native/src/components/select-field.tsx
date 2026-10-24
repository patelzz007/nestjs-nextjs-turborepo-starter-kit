// A labelled dropdown: the field shows the chosen option; pressing it opens a
// sheet listing every option, with an optional search box that filters them
// (for long lists; `Combobox` is the search-first variant). Generic over the
// option value, controlled and data-agnostic: `value` in, `onChange(next)`
// out — the caller owns the options and the choice. Opening, closing and the
// search text are the field's own display state; the search starts empty
// every time it opens.
//
// The parts are exported for other pickers (`Combobox` composes them):
// `SelectTrigger` (the pressable field) and `SelectOptionSheet` (the sheet of
// options with its search box).

import { cva, type VariantProps } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import * as React from "react";
import {
	ActivityIndicator,
	FlatList,
	type GestureResponderEvent,
	type ListRenderItemInfo,
	type NativeSyntheticEvent,
	Pressable,
	type TargetedEvent,
	Text,
	TextInput,
	View,
	type ViewInstance,
} from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import type { ValueHandler } from "../lib/value-handler";
import { BottomSheet, SheetOptionRow } from "./bottom-sheet";
import { Icon, type LucideIcon } from "./icon";
import { ErrorText, Label, MutedText } from "./text";

type FocusHandler = (event: NativeSyntheticEvent<TargetedEvent>) => void;

export const selectTriggerVariants = cva("flex-row items-center gap-3 border active:opacity-70", {
	variants: {
		/** `default`: an input on the card colour. `muted`: a borderless, filled field (a toolbar, a dense form). */
		variant: {
			default: "border-input bg-card",
			muted: "border-transparent bg-muted",
		},
		size: {
			md: "min-h-12 rounded-xl px-3.5 py-2.5",
			sm: "min-h-11 rounded-lg px-3 py-2",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border-destructive",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

export const selectValueVariants = cva("font-sans", {
	variants: {
		size: { md: "text-base", sm: "text-sm" },
		/** No option is chosen: the placeholder shows, muted. */
		placeholder: { true: "text-muted-foreground", false: "text-foreground" },
	},
	defaultVariants: { size: "md", placeholder: false },
});

type SelectTriggerVariantProps = VariantProps<typeof selectTriggerVariants>;
export type SelectVariant = NonNullable<SelectTriggerVariantProps["variant"]>;
export type SelectSize = NonNullable<SelectTriggerVariantProps["size"]>;

/** What screen readers say after the field's name while nothing is chosen and there is no placeholder. */
const NOTHING_CHOSEN = "none selected";

export interface SelectOption<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
	/** A second line under the label ("Your repository · pushed 2 days ago"). */
	readonly description?: string;
	/** This one option cannot be chosen. */
	readonly disabled?: boolean;
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

/** The option whose value is `value`, if any. */
function chosenOptionOf<TValue extends string>(options: readonly SelectOption<TValue>[], value: TValue | null): SelectOption<TValue> | undefined {
	return value === null ? undefined : options.find((option: SelectOption<TValue>): boolean => option.value === value);
}

// --- SelectTrigger ---------------------------------------------------------

export interface SelectTriggerProps {
	/** The field's name: the start of its accessible name ("Fruit, Apple"). */
	readonly label: string;
	/** The chosen option's label, or nothing while none is chosen. */
	readonly valueLabel: string | undefined;
	/** A second line under the chosen option. */
	readonly valueDescription?: string | undefined;
	/** Shown, muted, while nothing is chosen. */
	readonly placeholder?: string | undefined;
	/** A glyph before the value (a search glyph for a combobox); decorative. */
	readonly leadingIcon?: LucideIcon | undefined;
	/** Whether the sheet it opens is showing. */
	readonly expanded: boolean;
	readonly onPress: (event: GestureResponderEvent) => void;
	readonly onFocus?: FocusHandler | undefined;
	readonly onBlur?: FocusHandler | undefined;
	readonly variant?: SelectVariant;
	readonly size?: SelectSize;
	readonly disabled?: boolean;
	readonly loading?: boolean;
	readonly invalid?: boolean;
	/** What pressing does, for screen readers (defaults to opening the options). */
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the trigger, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The pressable field of a picker: the chosen value (or a placeholder) and a chevron. */
export const SelectTrigger = React.memo(
	React.forwardRef<ViewInstance, SelectTriggerProps>(function SelectTrigger(
		{
			label,
			valueLabel,
			valueDescription,
			placeholder,
			leadingIcon,
			expanded,
			onPress,
			onFocus,
			onBlur,
			variant = "default",
			size = "md",
			disabled = false,
			loading = false,
			invalid = false,
			accessibilityHint = "Opens the list of options",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ expanded, disabled: isInactive, busy: loading }), [expanded, isInactive, loading]);
		const isPlaceholder = valueLabel === undefined;
		return (
			<Pressable
				ref={ref}
				accessibilityRole="combobox"
				accessibilityLabel={`${label}, ${valueLabel ?? placeholder ?? NOTHING_CHOSEN}`}
				accessibilityHint={accessibilityHint}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={onPress}
				onFocus={onFocus}
				onBlur={onBlur}
				testID={testID}
				className={cn(selectTriggerVariants({ variant, size, state }), className)}>
				{leadingIcon === undefined ? null : <Icon icon={leadingIcon} size="md" colorClassName="accent-muted-foreground" />}
				<View className="flex-1 gap-0.5">
					<Text className={selectValueVariants({ size, placeholder: isPlaceholder })} numberOfLines={1}>
						{valueLabel ?? placeholder ?? ""}
					</Text>
					{valueDescription === undefined ? null : (
						<Text className="font-sans text-xs text-muted-foreground" numberOfLines={1}>
							{valueDescription}
						</Text>
					)}
				</View>
				{loading ? (
					<ActivityIndicator size="small" colorClassName="accent-muted-foreground" />
				) : (
					<Icon icon={ChevronDownIcon} size="md" colorClassName="accent-muted-foreground" />
				)}
			</Pressable>
		);
	}),
);

// --- SelectOptionSheet -----------------------------------------------------

export interface SelectOptionSheetProps<TValue extends string> {
	readonly visible: boolean;
	/** The sheet's heading; also names the search box ("Search fruit"). */
	readonly title: string;
	readonly options: readonly SelectOption<TValue>[];
	readonly value: NoInfer<TValue> | null;
	/** An option was chosen (also the current one: the caller decides what that means). */
	readonly onSelect: ValueHandler<TValue>;
	readonly onClose: () => void;
	/** Show a search box that filters the options by label and description. */
	readonly searchable?: boolean;
	/** The search text: the caller's display state, cleared when it opens the sheet. */
	readonly query: string;
	readonly onQueryChange: (query: string) => void;
	readonly searchPlaceholder?: string;
	/** Focus the search box as the sheet opens (a search-first picker). */
	readonly autoFocusSearch?: boolean;
	/** Shown when the search matches nothing. */
	readonly noMatchesMessage?: string;
	/** Extra classes for the sheet's content, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** `SelectOptionSheet` keeps its option type through `memo` and `forwardRef`. */
export interface SelectOptionSheetComponent {
	<TValue extends string>(props: SelectOptionSheetProps<TValue> & React.RefAttributes<ViewInstance>): React.ReactNode;
	displayName?: string | undefined;
}

/** The sheet of options, under a search box that stays put while the (virtualized) list scrolls. */
export const SelectOptionSheet: SelectOptionSheetComponent = React.memo(
	React.forwardRef(function SelectOptionSheet(
		{
			visible,
			title,
			options,
			value,
			onSelect,
			onClose,
			searchable = false,
			query,
			onQueryChange,
			searchPlaceholder = "Search",
			autoFocusSearch = false,
			noMatchesMessage = "Nothing matches your search.",
			className,
			testID,
		}: SelectOptionSheetProps<string>,
		ref: React.ForwardedRef<ViewInstance>,
	): React.JSX.Element {
		const shown = React.useMemo(() => filterSelectOptions(options, searchable ? query : ""), [options, query, searchable]);
		const renderOption = React.useCallback(
			({ item }: ListRenderItemInfo<SelectOption<string>>): React.JSX.Element => (
				<SheetOptionRow
					value={item.value}
					label={item.label}
					description={item.description}
					disabled={item.disabled === true}
					selected={item.value === value}
					onSelect={onSelect}
				/>
			),
			[onSelect, value],
		);
		const keyOf = React.useCallback((option: SelectOption<string>): string => option.value, []);
		return (
			<BottomSheet visible={visible} title={title} onClose={onClose} scrollsItself testID={testID}>
				<View ref={ref} className={cn("shrink gap-3", className)}>
					{searchable ? (
						<TextInput
							accessibilityLabel={`Search ${title.toLowerCase()}`}
							value={query}
							onChangeText={onQueryChange}
							placeholder={searchPlaceholder}
							placeholderTextColorClassName="accent-muted-foreground"
							autoCapitalize="none"
							autoCorrect={false}
							autoFocus={autoFocusSearch}
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
			</BottomSheet>
		);
	}),
);

// --- SelectField -----------------------------------------------------------

export interface SelectFieldProps<TValue extends string> {
	/** Visible label, the sheet's title and the field's accessible name. */
	readonly label: string;
	readonly options: readonly SelectOption<TValue>[];
	/** The chosen option, or `null` while nothing is chosen (the placeholder shows). */
	readonly value: NoInfer<TValue> | null;
	readonly onChange: ValueHandler<TValue>;
	readonly onFocus?: FocusHandler | undefined;
	readonly onBlur?: FocusHandler | undefined;
	/** Shown, muted, while nothing is chosen. */
	readonly placeholder?: string;
	/** Show a search box that filters the options by label and description. */
	readonly searchable?: boolean;
	readonly searchPlaceholder?: string;
	/** Focus the search box as the sheet opens (a search-first picker; needs `searchable`). */
	readonly autoFocusSearch?: boolean;
	/** Shown when the search matches nothing. */
	readonly noMatchesMessage?: string;
	/** A glyph before the value; decorative. */
	readonly leadingIcon?: LucideIcon | undefined;
	/** What pressing the field does, for screen readers. */
	readonly accessibilityHint?: string;
	/** A hint under the field. */
	readonly hint?: string;
	/** The first validation message, or nothing. Implies `invalid`. */
	readonly error?: string | undefined;
	/** The caller's validation outcome, when there is no message to show. */
	readonly invalid?: boolean;
	readonly disabled?: boolean;
	/** The options are loading: blocks opening and shows a spinner. */
	readonly loading?: boolean;
	readonly variant?: SelectVariant;
	readonly size?: SelectSize;
	/** Extra classes for the field's container (label, trigger, messages), merged last. */
	readonly className?: string;
	/** The trigger's test ID. */
	readonly testID?: string;
}

/** `SelectField` keeps its option type through `memo` and `forwardRef`. The ref reaches the trigger. */
export interface SelectFieldComponent {
	<TValue extends string>(props: SelectFieldProps<TValue> & React.RefAttributes<ViewInstance>): React.ReactNode;
	displayName?: string | undefined;
}

export const selectFieldVariants = cva("", {
	variants: {
		size: { md: "gap-1.5", sm: "gap-1" },
	},
	defaultVariants: { size: "md" },
});

export const SelectField: SelectFieldComponent = React.memo(
	React.forwardRef(function SelectField(
		{
			label,
			options,
			value,
			onChange,
			onFocus,
			onBlur,
			placeholder,
			searchable = false,
			searchPlaceholder = "Search",
			autoFocusSearch = false,
			noMatchesMessage = "Nothing matches your search.",
			leadingIcon,
			accessibilityHint,
			hint,
			error,
			invalid = false,
			disabled = false,
			loading = false,
			variant = "default",
			size = "md",
			className,
			testID,
		}: SelectFieldProps<string>,
		ref: React.ForwardedRef<ViewInstance>,
	): React.JSX.Element {
		const [open, setOpen] = React.useState(false);
		const [query, setQuery] = React.useState("");
		const hasError = error !== undefined && error.length > 0;
		const selected = chosenOptionOf(options, value);

		const openSheet = React.useCallback((): void => {
			setQuery("");
			setOpen(true);
		}, []);
		const closeSheet = React.useCallback((): void => {
			setOpen(false);
		}, []);
		const choose = React.useCallback(
			(next: string): void => {
				setOpen(false);
				if (next !== value) {
					onChange(next);
				}
			},
			[onChange, value],
		);

		return (
			<View className={cn(selectFieldVariants({ size }), className)}>
				<Label>{label}</Label>
				<SelectTrigger
					ref={ref}
					label={label}
					valueLabel={selected?.label}
					valueDescription={selected?.description}
					placeholder={placeholder}
					leadingIcon={leadingIcon}
					expanded={open}
					onPress={openSheet}
					onFocus={onFocus}
					onBlur={onBlur}
					variant={variant}
					size={size}
					disabled={disabled}
					loading={loading}
					invalid={invalid || hasError}
					accessibilityHint={accessibilityHint}
					testID={testID}
				/>
				{hint === undefined ? null : <MutedText>{hint}</MutedText>}
				{hasError ? (
					<ErrorText accessibilityRole="alert" accessibilityLiveRegion="polite">
						{error}
					</ErrorText>
				) : null}
				<SelectOptionSheet
					visible={open}
					title={label}
					options={options}
					value={value}
					onSelect={choose}
					onClose={closeSheet}
					searchable={searchable}
					autoFocusSearch={autoFocusSearch}
					query={query}
					onQueryChange={setQuery}
					searchPlaceholder={searchPlaceholder}
					noMatchesMessage={noMatchesMessage}
				/>
			</View>
		);
	}),
);
