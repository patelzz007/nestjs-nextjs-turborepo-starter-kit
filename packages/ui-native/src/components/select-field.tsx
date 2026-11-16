// A labelled dropdown: the field shows the chosen option; pressing it opens a
// sheet listing every option, with an optional search box that filters them
// (for long lists; `Combobox` is the search-first variant). Generic over the
// option value, controlled and data-agnostic: `value` in, `onChange(next)`
// out — the caller owns the options and the choice. Opening, closing and the
// search text are the field's own display state; the search starts empty
// every time it opens.
//
// Options may carry a `leading` element (an avatar, a flag, a status dot), a
// `trailing` one (a badge, a UTC offset) and a `group` (a heading over the
// options that share it). `MultiSelectField` picks several: its field holds
// the chosen options as chips (removable or not) or a summary, and its sheet
// stays open while options are ticked.
//
// The parts are exported for other pickers (`Combobox` composes them):
// `SelectTrigger` (the pressable field) and `SelectOptionSheet` (the sheet of
// options with its search box).

import { cva, type VariantProps } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import XIcon from "lucide-react-native/icons/x";
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
import { resolveControlState } from "../lib/control-state";
import { FIELD_SURFACE_FILL, useFieldSurface } from "../lib/field-surface";
import type { ValueHandler } from "../lib/value-handler";
import { BottomSheet, type SheetOptionIndicatorPosition, SheetOptionRow } from "./bottom-sheet";
import { Icon, type LucideIcon } from "./icon";
import { ErrorText, Label, MutedText } from "./text";

type FocusHandler = (event: NativeSyntheticEvent<TargetedEvent>) => void;

export const selectTriggerVariants = cva("flex-row items-center gap-3 border active:opacity-70", {
	variants: {
		/** `default`: an outlined input in the fill of the surface under it. `muted`: a borderless, filled field (a toolbar, a dense form). `ghost`: no border and no fill (tags sitting loose on the page). */
		variant: {
			default: "border-input",
			muted: "border-transparent",
			ghost: "border-transparent",
		},
		/** The surface the field sits on (lib/field-surface.ts): the outlined field takes its fill. */
		surface: {
			page: FIELD_SURFACE_FILL.page,
			card: FIELD_SURFACE_FILL.card,
			popover: FIELD_SURFACE_FILL.popover,
		},
		size: {
			md: "rounded-button min-h-12 px-3.5 py-2.5",
			sm: "rounded-button min-h-11 px-3 py-2",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border-destructive",
		},
	},
	// The muted field keeps its own well on every surface; the ghost one shows the surface through.
	compoundVariants: [
		{ variant: "muted", className: "bg-muted" },
		{ variant: "ghost", className: "bg-transparent" },
	],
	defaultVariants: { variant: "default", size: "md", state: "default", surface: "page" },
});

export const selectValueVariants = cva("font-sans", {
	variants: {
		size: { md: "text-body-lg", sm: "text-body" },
		/** No option is chosen: the placeholder shows, muted. */
		placeholder: { true: "text-muted-foreground", false: "text-foreground" },
	},
	defaultVariants: { size: "md", placeholder: false },
});

/** The clear button over the trigger's end, centred where the chevron sits (its padding plus half the glyph, less half the 44 pt button). */
export const selectClearVariants = cva("absolute top-0 bottom-0 justify-center", {
	variants: {
		size: { md: "right-0.5", sm: "right-0" },
	},
	defaultVariants: { size: "md" },
});

/** One chosen option of a multiple select, as a chip in its field. */
export const selectChipVariants = cva("flex-row items-center gap-1 rounded-full bg-secondary py-1 pl-2.5", {
	variants: {
		/** A removable chip ends in its own remove button. */
		removable: { true: "pr-1", false: "pr-2.5" },
	},
	defaultVariants: { removable: true },
});

type SelectTriggerVariantProps = VariantProps<typeof selectTriggerVariants>;
export type SelectVariant = NonNullable<SelectTriggerVariantProps["variant"]>;
export type SelectSize = NonNullable<SelectTriggerVariantProps["size"]>;

/** What screen readers say after the field's name while nothing is chosen and there is no placeholder. */
const NOTHING_CHOSEN = "none selected";
/** The 44 pt clear and remove buttons' extra touch area around their glyphs (rules/04). */
const BUTTON_HIT_SLOP = 8;

export interface SelectOption<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
	/** A second line under the label ("Your repository · pushed 2 days ago"). */
	readonly description?: string | undefined;
	/** This one option cannot be chosen. */
	readonly disabled?: boolean | undefined;
	/** Before the label, in the list and in the field once chosen: an avatar, a flag, a status dot. Decorative. */
	readonly leading?: React.ReactNode | undefined;
	/** After the label, in the list: a badge, a count, a UTC offset. Decorative. */
	readonly trailing?: React.ReactNode | undefined;
	/** The heading this option is listed under; options of one group are kept together, in the order given. */
	readonly group?: string | undefined;
	/** Extra classes for the option's label in the list (a font previewed in its own face). */
	readonly labelClassName?: string | undefined;
}

/** Draws the chosen option in the field in place of its label. Checked bivariantly (lib/value-handler.ts). */
export type SelectValueRenderer<TValue extends string> = { bivarianceHack(option: SelectOption<NoInfer<TValue>>): React.ReactNode }["bivarianceHack"];
/** Draws a multiple select's chosen options in its field in place of chips. Checked bivariantly (lib/value-handler.ts). */
export type SelectValuesRenderer<TValue extends string> = {
	bivarianceHack(options: readonly SelectOption<NoInfer<TValue>>[]): React.ReactNode;
}["bivarianceHack"];

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

/** One row of a sheet's list: a group's heading, or an option. */
export type SelectListRow<TValue extends string> =
	| { readonly kind: "heading"; readonly key: string; readonly label: string; readonly separated: boolean }
	| { readonly kind: "option"; readonly key: string; readonly option: SelectOption<TValue> };

/**
 * The list a sheet shows: each group's options under its heading (the groups in
 * the order they first appear, the options in the order given), the options
 * without a group first. With `separated`, every heading but the first is
 * marked to draw a rule above it.
 */
export function selectListRowsOf<TValue extends string>(options: readonly SelectOption<TValue>[], separated: boolean): readonly SelectListRow<TValue>[] {
	const ungrouped: SelectListRow<TValue>[] = [];
	const groups = new Map<string, SelectOption<TValue>[]>();
	options.forEach((option: SelectOption<TValue>): void => {
		if (option.group === undefined) {
			ungrouped.push({ kind: "option", key: option.value, option });
			return;
		}
		const members = groups.get(option.group) ?? [];
		members.push(option);
		groups.set(option.group, members);
	});
	const rows: SelectListRow<TValue>[] = [...ungrouped];
	[...groups.entries()].forEach(([group, members]: [string, SelectOption<TValue>[]]): void => {
		rows.push({ kind: "heading", key: `group:${group}`, label: group, separated: separated && rows.length > 0 });
		members.forEach((option: SelectOption<TValue>): void => {
			rows.push({ kind: "option", key: option.value, option });
		});
	});
	return rows;
}

/** The option whose value is `value`, if any. */
function chosenOptionOf<TValue extends string>(options: readonly SelectOption<TValue>[], value: TValue | null): SelectOption<TValue> | undefined {
	return value === null ? undefined : options.find((option: SelectOption<TValue>): boolean => option.value === value);
}

/** The options whose values are in `values`, in the order of `values`. */
function chosenOptionsOf<TValue extends string>(options: readonly SelectOption<TValue>[], values: readonly TValue[]): readonly SelectOption<TValue>[] {
	return values.flatMap((value: TValue): SelectOption<TValue>[] => {
		const option = chosenOptionOf(options, value);
		return option === undefined ? [] : [option];
	});
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
	/** Before the value, after `leadingIcon`: the chosen option's avatar, flag or dot. Decorative. */
	readonly leading?: React.ReactNode | undefined;
	/** A muted word before the value ("Status:"). */
	readonly prefix?: string | undefined;
	/** Drawn in place of the value's text (a badge, stacked avatars); the accessible name still reads `valueLabel`. */
	readonly valueContent?: React.ReactNode | undefined;
	/** The glyph at the end. Default a chevron down. */
	readonly chevronIcon?: LucideIcon | undefined;
	/** Shows a clear button over the chevron while a value is chosen; called when it is pressed. */
	readonly onClear?: (() => void) | undefined;
	/** The clear button's accessible name. Default "Clear <label>". */
	readonly clearLabel?: string | undefined;
	/** Whether the sheet it opens is showing. */
	readonly expanded: boolean;
	readonly onPress: (event: GestureResponderEvent) => void;
	readonly onFocus?: FocusHandler | undefined;
	readonly onBlur?: FocusHandler | undefined;
	readonly variant?: SelectVariant | undefined;
	readonly size?: SelectSize | undefined;
	readonly disabled?: boolean | undefined;
	readonly loading?: boolean | undefined;
	readonly invalid?: boolean | undefined;
	/** What pressing does, for screen readers (defaults to opening the options). */
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the trigger, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The pressable field of a picker: the chosen value (or a placeholder) and a chevron — or, with `onClear` and a value, a clear button. */
export const SelectTrigger = React.memo(
	React.forwardRef<ViewInstance, SelectTriggerProps>(function SelectTrigger(
		{
			label,
			valueLabel,
			valueDescription,
			placeholder,
			leadingIcon,
			leading,
			prefix,
			valueContent,
			chevronIcon = ChevronDownIcon,
			onClear,
			clearLabel,
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
		const surface = useFieldSurface();
		const state = resolveControlState({ disabled, loading, invalid });
		// Compared, not called, so the compiler can memoise the accessibility state.
		const isInactive = state === "disabled" || state === "loading";
		const accessibilityState = React.useMemo(() => ({ expanded, disabled: isInactive, busy: loading }), [expanded, isInactive, loading]);
		const isPlaceholder = valueLabel === undefined;
		const canClear = onClear !== undefined && !isPlaceholder && !isInactive;
		const trigger = (
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
				className={cn(selectTriggerVariants({ variant, size, state, surface }), className)}>
				{leadingIcon === undefined ? null : <Icon icon={leadingIcon} size="md" colorClassName="accent-icon" />}
				{isPlaceholder || leading === undefined ? null : leading}
				<View className="flex-1 flex-row items-center gap-1.5">
					{prefix === undefined ? null : <Text className={selectValueVariants({ size, placeholder: true })}>{prefix}</Text>}
					{isPlaceholder || valueContent === undefined ? (
						<View className="flex-1 gap-0.5">
							<Text className={selectValueVariants({ size, placeholder: isPlaceholder })} numberOfLines={1}>
								{valueLabel ?? placeholder ?? ""}
							</Text>
							{valueDescription === undefined ? null : (
								<Text className="text-caption font-sans text-muted-foreground" numberOfLines={1}>
									{valueDescription}
								</Text>
							)}
						</View>
					) : (
						<View className="flex-1 flex-row items-center">{valueContent}</View>
					)}
				</View>
				<SelectTriggerEnd loading={loading} cleared={canClear} chevronIcon={chevronIcon} />
			</Pressable>
		);
		if (!canClear) {
			return trigger;
		}
		return (
			<View className="justify-center">
				{trigger}
				<View className={selectClearVariants({ size })}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={clearLabel ?? `Clear ${label.toLowerCase()}`}
						onPress={onClear}
						hitSlop={BUTTON_HIT_SLOP}
						testID={testID === undefined ? undefined : `${testID}-clear`}
						className="size-11 items-center justify-center rounded-full active:opacity-60">
						<Icon icon={XIcon} size="sm" colorClassName="accent-icon" />
					</Pressable>
				</View>
			</View>
		);
	}),
);

interface SelectTriggerEndProps {
	readonly loading: boolean;
	/** The clear button covers this spot: keep its room, draw nothing. */
	readonly cleared: boolean;
	readonly chevronIcon: LucideIcon;
}

/** The trigger's end: a spinner while loading, the room under the clear button, or the chevron. */
function SelectTriggerEnd({ loading, cleared, chevronIcon }: SelectTriggerEndProps): React.JSX.Element {
	if (loading) {
		return <ActivityIndicator size="small" colorClassName="accent-muted-foreground" />;
	}
	if (cleared) {
		return <View className="size-5" />;
	}
	return <Icon icon={chevronIcon} size="md" colorClassName="accent-icon" />;
}

// --- SelectOptionSheet -----------------------------------------------------

export interface SelectOptionSheetProps<TValue extends string> {
	readonly visible: boolean;
	/** The sheet's heading; also names the search box ("Search fruit"). */
	readonly title: string;
	readonly options: readonly SelectOption<TValue>[];
	/** The chosen option of a single select. */
	readonly value: NoInfer<TValue> | null;
	/** The chosen options of a multiple select (`multiple`); `value` is then ignored. */
	readonly values?: readonly NoInfer<TValue>[] | undefined;
	/** Rows are checkboxes, each its own choice; the sheet stays open as they are ticked. */
	readonly multiple?: boolean | undefined;
	/** An option was chosen (also the current one: the caller decides what that means). */
	readonly onSelect: ValueHandler<TValue>;
	readonly onClose: () => void;
	/** Show a search box that filters the options by label and description. */
	readonly searchable?: boolean | undefined;
	/** The search text: the caller's display state, cleared when it opens the sheet. */
	readonly query: string;
	readonly onQueryChange: (query: string) => void;
	readonly searchPlaceholder?: string | undefined;
	/** Focus the search box as the sheet opens (a search-first picker). */
	readonly autoFocusSearch?: boolean | undefined;
	/** Tint the first option the search matches; the keyboard's Return key picks it. */
	readonly autoHighlight?: boolean | undefined;
	/** Draw a rule between groups, above every heading but the first. */
	readonly groupSeparators?: boolean | undefined;
	/** Where a chosen row's tick sits. Default `end`. */
	readonly indicatorPosition?: SheetOptionIndicatorPosition | undefined;
	/** Shown when the search matches nothing. */
	readonly noMatchesMessage?: string | undefined;
	/** Extra classes for the sheet's content, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** `SelectOptionSheet` keeps its option type through `memo` and `forwardRef`. */
export interface SelectOptionSheetComponent {
	<TValue extends string>(props: SelectOptionSheetProps<TValue> & React.RefAttributes<ViewInstance>): React.ReactNode;
	displayName?: string | undefined;
}

export const selectGroupHeadingVariants = cva("font-sans-medium text-caption pt-3 pb-1 text-muted-foreground", {
	variants: {
		/** A rule above the heading, between two groups. */
		separated: { true: "mt-2 border-t border-border", false: "" },
	},
	defaultVariants: { separated: false },
});

const NO_VALUES: readonly string[] = [];

/** The sheet of options, under a search box that stays put while the (virtualized) list scrolls. */
export const SelectOptionSheet: SelectOptionSheetComponent = React.memo(
	React.forwardRef(function SelectOptionSheet(
		{
			visible,
			title,
			options,
			value,
			values = NO_VALUES,
			multiple = false,
			onSelect,
			onClose,
			searchable = false,
			query,
			onQueryChange,
			searchPlaceholder = "Search",
			autoFocusSearch = false,
			autoHighlight = false,
			groupSeparators = false,
			indicatorPosition = "end",
			noMatchesMessage = "Nothing matches your search.",
			className,
			testID,
		}: SelectOptionSheetProps<string>,
		ref: React.ForwardedRef<ViewInstance>,
	): React.JSX.Element {
		const shown = React.useMemo(() => filterSelectOptions(options, searchable ? query : ""), [options, query, searchable]);
		const rows = React.useMemo(() => selectListRowsOf(shown, groupSeparators), [groupSeparators, shown]);
		const highlighted = autoHighlight ? shown.find((option: SelectOption<string>): boolean => option.disabled !== true) : undefined;
		const chosen = React.useMemo(() => new Set<string>(multiple ? values : value === null ? [] : [value]), [multiple, value, values]);
		const pickHighlighted = React.useCallback((): void => {
			if (highlighted !== undefined) {
				onSelect(highlighted.value);
			}
		}, [highlighted, onSelect]);
		const renderRow = React.useCallback(
			({ item }: ListRenderItemInfo<SelectListRow<string>>): React.JSX.Element => {
				if (item.kind === "heading") {
					return (
						<Text accessibilityRole="header" className={selectGroupHeadingVariants({ separated: item.separated })}>
							{item.label}
						</Text>
					);
				}
				const { option } = item;
				return (
					<SheetOptionRow
						value={option.value}
						label={option.label}
						description={option.description}
						disabled={option.disabled === true}
						selected={chosen.has(option.value)}
						onSelect={onSelect}
						leading={option.leading}
						trailing={option.trailing}
						labelClassName={option.labelClassName}
						indicatorPosition={indicatorPosition}
						multiple={multiple}
						highlighted={option.value === highlighted?.value}
					/>
				);
			},
			[chosen, highlighted?.value, indicatorPosition, multiple, onSelect],
		);
		const keyOf = React.useCallback((row: SelectListRow<string>): string => row.key, []);
		return (
			<BottomSheet visible={visible} title={title} onClose={onClose} scrollsItself testID={testID}>
				<View ref={ref} className={cn("shrink gap-3", className)}>
					{searchable ? (
						<TextInput
							accessibilityLabel={`Search ${title.toLowerCase()}`}
							value={query}
							onChangeText={onQueryChange}
							onSubmitEditing={pickHighlighted}
							placeholder={searchPlaceholder}
							placeholderTextColorClassName="accent-muted-foreground"
							autoCapitalize="none"
							autoCorrect={false}
							autoFocus={autoFocusSearch}
							returnKeyType={autoHighlight ? "done" : "search"}
							className="text-body-lg rounded-button min-h-11 border border-input bg-popover px-3.5 py-2.5 font-sans text-foreground"
						/>
					) : null}
					<FlatList
						data={rows}
						keyExtractor={keyOf}
						renderItem={renderRow}
						keyboardShouldPersistTaps="handled"
						ListEmptyComponent={<MutedText>{noMatchesMessage}</MutedText>}
					/>
				</View>
			</BottomSheet>
		);
	}),
);

// --- SelectField -----------------------------------------------------------

/** The props `SelectField` and `MultiSelectField` share. */
interface SelectFieldBaseProps<TValue extends string> {
	/** Visible label, the sheet's title and the field's accessible name. */
	readonly label: string;
	/** Hide the visible label (the field sits under a heading that names it); it still names the field for screen readers. */
	readonly hideLabel?: boolean | undefined;
	readonly options: readonly SelectOption<TValue>[];
	readonly onFocus?: FocusHandler | undefined;
	readonly onBlur?: FocusHandler | undefined;
	/** Shown, muted, while nothing is chosen. */
	readonly placeholder?: string | undefined;
	/** Show a search box that filters the options by label and description. */
	readonly searchable?: boolean | undefined;
	readonly searchPlaceholder?: string | undefined;
	/** Focus the search box as the sheet opens (a search-first picker; needs `searchable`). */
	readonly autoFocusSearch?: boolean | undefined;
	/** Tint the first option the search matches; the keyboard's Return key picks it (needs `searchable`). */
	readonly autoHighlight?: boolean | undefined;
	/** Shown when the search matches nothing. */
	readonly noMatchesMessage?: string | undefined;
	/** Draw a rule between option groups. */
	readonly groupSeparators?: boolean | undefined;
	/** Where a chosen row's tick sits. Default `end`. */
	readonly indicatorPosition?: SheetOptionIndicatorPosition | undefined;
	/** A glyph before the value; decorative. */
	readonly leadingIcon?: LucideIcon | undefined;
	/** The glyph at the field's end. Default a chevron down. */
	readonly chevronIcon?: LucideIcon | undefined;
	/** What pressing the field does, for screen readers. */
	readonly accessibilityHint?: string | undefined;
	/** A hint under the field. */
	readonly hint?: string | undefined;
	/** The first validation message, or nothing. Implies `invalid`. */
	readonly error?: string | undefined;
	/** The caller's validation outcome, when there is no message to show. */
	readonly invalid?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** The options are loading: blocks opening and shows a spinner. */
	readonly loading?: boolean | undefined;
	readonly variant?: SelectVariant | undefined;
	readonly size?: SelectSize | undefined;
	/** Extra classes for the field's container (label, trigger, messages), merged last. */
	readonly className?: string | undefined;
	/** The trigger's test ID. */
	readonly testID?: string | undefined;
}

export interface SelectFieldProps<TValue extends string> extends SelectFieldBaseProps<TValue> {
	/** The chosen option, or `null` while nothing is chosen (the placeholder shows). */
	readonly value: NoInfer<TValue> | null;
	readonly onChange: ValueHandler<TValue>;
	/** Shows a clear button in the field while an option is chosen; the caller sets the value back to `null`. */
	readonly onClear?: (() => void) | undefined;
	/** The clear button's accessible name. Default "Clear <label>". */
	readonly clearLabel?: string | undefined;
	/** A muted word before the value ("Status:"). */
	readonly prefix?: string | undefined;
	/** Draws the chosen option in the field in place of its label (a badge); the chosen option's `leading` still shows before it. */
	readonly renderValue?: SelectValueRenderer<TValue> | undefined;
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

interface SelectMessagesProps {
	readonly hint: string | undefined;
	readonly error: string | undefined;
}

/** The hint and the validation message under a field. */
function SelectMessages({ hint, error }: SelectMessagesProps): React.JSX.Element {
	return (
		<>
			{hint === undefined ? null : <MutedText>{hint}</MutedText>}
			{error === undefined || error.length === 0 ? null : (
				<ErrorText accessibilityRole="alert" accessibilityLiveRegion="polite">
					{error}
				</ErrorText>
			)}
		</>
	);
}

/** Opening and closing a picker's sheet; the search starts empty each time it opens. */
function usePickerSheet(): {
	readonly open: boolean;
	readonly query: string;
	readonly setQuery: (query: string) => void;
	readonly openSheet: () => void;
	readonly closeSheet: () => void;
} {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const openSheet = React.useCallback((): void => {
		setQuery("");
		setOpen(true);
	}, []);
	const closeSheet = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return { open, query, setQuery, openSheet, closeSheet };
}

export const SelectField: SelectFieldComponent = React.memo(
	React.forwardRef(function SelectField(
		{
			label,
			hideLabel = false,
			options,
			value,
			onChange,
			onClear,
			clearLabel,
			prefix,
			renderValue,
			onFocus,
			onBlur,
			placeholder,
			searchable = false,
			searchPlaceholder = "Search",
			autoFocusSearch = false,
			autoHighlight = false,
			noMatchesMessage = "Nothing matches your search.",
			groupSeparators = false,
			indicatorPosition = "end",
			leadingIcon,
			chevronIcon,
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
		const { open, query, setQuery, openSheet, closeSheet } = usePickerSheet();
		const hasError = error !== undefined && error.length > 0;
		const selected = chosenOptionOf(options, value);
		const choose = React.useCallback(
			(next: string): void => {
				closeSheet();
				if (next !== value) {
					onChange(next);
				}
			},
			[closeSheet, onChange, value],
		);

		return (
			<View className={cn(selectFieldVariants({ size }), className)}>
				{hideLabel ? null : <Label>{label}</Label>}
				<SelectTrigger
					ref={ref}
					label={label}
					valueLabel={selected?.label}
					valueDescription={selected?.description}
					valueContent={selected === undefined || renderValue === undefined ? undefined : renderValue(selected)}
					placeholder={placeholder}
					leadingIcon={leadingIcon}
					leading={selected?.leading}
					prefix={prefix}
					chevronIcon={chevronIcon}
					onClear={onClear}
					clearLabel={clearLabel}
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
				<SelectMessages hint={hint} error={error} />
				<SelectOptionSheet
					visible={open}
					title={label}
					options={options}
					value={value}
					onSelect={choose}
					onClose={closeSheet}
					searchable={searchable}
					autoFocusSearch={autoFocusSearch}
					autoHighlight={autoHighlight}
					groupSeparators={groupSeparators}
					indicatorPosition={indicatorPosition}
					query={query}
					onQueryChange={setQuery}
					searchPlaceholder={searchPlaceholder}
					noMatchesMessage={noMatchesMessage}
				/>
			</View>
		);
	}),
);

// --- MultiSelectField ------------------------------------------------------

/** How a multiple select shows its chosen options: chips with remove buttons, chips without, or a summary line. */
export type SelectChips = "removable" | "static" | "none";

export interface MultiSelectFieldProps<TValue extends string> extends SelectFieldBaseProps<TValue> {
	/** The chosen options, in the order they were chosen. */
	readonly values: readonly NoInfer<TValue>[];
	readonly onChange: ValueHandler<readonly TValue[]>;
	/** How the field shows what is chosen. Default `removable`. */
	readonly chips?: SelectChips | undefined;
	/** Draws the chosen options in the field in place of chips or the summary (stacked avatars, dots). */
	readonly renderValues?: SelectValuesRenderer<TValue> | undefined;
}

/** `MultiSelectField` keeps its option type through `memo` and `forwardRef`. The ref reaches the trigger. */
export interface MultiSelectFieldComponent {
	<TValue extends string>(props: MultiSelectFieldProps<TValue> & React.RefAttributes<ViewInstance>): React.ReactNode;
	displayName?: string | undefined;
}

/** `values` with `value` added at the end, or taken out when it is there. */
export function toggleSelectValue<TValue extends string>(values: readonly TValue[], value: TValue): readonly TValue[] {
	return values.includes(value) ? values.filter((chosen: TValue): boolean => chosen !== value) : [...values, value];
}

interface SelectChipProps {
	readonly option: SelectOption<string>;
	/** Removes the option; a chip without it has no remove button. */
	readonly onRemove: ((value: string) => void) | undefined;
	readonly disabled: boolean;
}

/** One chosen option in a multiple select's field. */
function SelectChip({ option, onRemove, disabled }: SelectChipProps): React.JSX.Element {
	const remove = React.useCallback((): void => {
		onRemove?.(option.value);
	}, [onRemove, option.value]);
	const removable = onRemove !== undefined;
	return (
		<View className={selectChipVariants({ removable })}>
			{option.leading === undefined ? null : <View importantForAccessibility="no-hide-descendants">{option.leading}</View>}
			<Text className="text-caption font-sans-medium text-secondary-foreground">{option.label}</Text>
			{removable ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`Remove ${option.label}`}
					disabled={disabled}
					onPress={remove}
					hitSlop={BUTTON_HIT_SLOP}
					className="size-6 items-center justify-center rounded-full active:opacity-60">
					<Icon icon={XIcon} size="xs" colorClassName="accent-icon" />
				</Pressable>
			) : null}
		</View>
	);
}

/** What a multiple select's field draws for its value: the caller's drawing, a count while the chips below list the options, or (nothing) the summary line. */
function multiValueContentOf(
	chosen: readonly SelectOption<string>[],
	renderValues: SelectValuesRenderer<string> | undefined,
	showChips: boolean,
	size: SelectSize,
): React.ReactNode {
	if (chosen.length === 0) {
		return undefined;
	}
	if (renderValues !== undefined) {
		return renderValues(chosen);
	}
	return showChips ? <Text className={selectValueVariants({ size })}>{`${String(chosen.length)} selected`}</Text> : undefined;
}

export const MultiSelectField: MultiSelectFieldComponent = React.memo(
	React.forwardRef(function MultiSelectField(
		{
			label,
			hideLabel = false,
			options,
			values,
			onChange,
			chips = "removable",
			renderValues,
			onFocus,
			onBlur,
			placeholder,
			searchable = false,
			searchPlaceholder = "Search",
			autoFocusSearch = false,
			autoHighlight = false,
			noMatchesMessage = "Nothing matches your search.",
			groupSeparators = false,
			indicatorPosition = "end",
			leadingIcon,
			chevronIcon,
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
		}: MultiSelectFieldProps<string>,
		ref: React.ForwardedRef<ViewInstance>,
	): React.JSX.Element {
		const { open, query, setQuery, openSheet, closeSheet } = usePickerSheet();
		const hasError = error !== undefined && error.length > 0;
		const chosen = chosenOptionsOf(options, values);
		const summary = chosen.length === 0 ? undefined : chosen.map((option: SelectOption<string>): string => option.label).join(", ");
		const toggle = React.useCallback(
			(value: string): void => {
				onChange(toggleSelectValue(values, value));
			},
			[onChange, values],
		);
		const showChips = chips !== "none" && renderValues === undefined && chosen.length > 0;
		const isInactive = disabled || loading;
		return (
			<View className={cn(selectFieldVariants({ size }), className)}>
				{hideLabel ? null : <Label>{label}</Label>}
				<SelectTrigger
					ref={ref}
					label={label}
					valueLabel={summary}
					valueContent={multiValueContentOf(chosen, renderValues, showChips, size)}
					placeholder={placeholder}
					leadingIcon={leadingIcon}
					chevronIcon={chevronIcon}
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
				{showChips ? (
					<View className="flex-row flex-wrap gap-1.5" testID={testID === undefined ? undefined : `${testID}-chips`}>
						{chosen.map((option: SelectOption<string>): React.JSX.Element => (
							<SelectChip key={option.value} option={option} onRemove={chips === "removable" ? toggle : undefined} disabled={isInactive} />
						))}
					</View>
				) : null}
				<SelectMessages hint={hint} error={error} />
				<SelectOptionSheet
					visible={open}
					title={label}
					options={options}
					value={null}
					values={values}
					multiple
					onSelect={toggle}
					onClose={closeSheet}
					searchable={searchable}
					autoFocusSearch={autoFocusSearch}
					autoHighlight={autoHighlight}
					groupSeparators={groupSeparators}
					indicatorPosition={indicatorPosition}
					query={query}
					onQueryChange={setQuery}
					searchPlaceholder={searchPlaceholder}
					noMatchesMessage={noMatchesMessage}
				/>
			</View>
		);
	}),
);
