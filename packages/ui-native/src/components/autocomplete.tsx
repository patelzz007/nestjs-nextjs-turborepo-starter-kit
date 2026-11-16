// A free-text field that suggests values as it is typed (the web kit's
// `Autocomplete`): the text is the value — a suggestion only fills it in.
// Matching suggestions list under the field (in the page, never floating, so
// nothing is clipped by a scrolling screen); tapping one fills the field and
// closes the list. `autoHighlight` marks the first match, which the keyboard's
// return key then takes. `showClear` adds an X once there is text; `showTrigger`
// a chevron that opens the full list before anything is typed. Suggestions may
// carry a `group`, listed under its heading. `status` is a line at the top of
// the list for an async lookup ("Searching…", "3 results", an error).
//
// Controlled: `value` (the text) in, `onChange(text)` out; `filter` decides
// what matches (default: every word of the query appears in the label, case
// and accents ignored), or pass `filter={null}` when the caller filters (a
// server lookup). Inside a `Field` it takes the field's label and state.

import { cva, type VariantProps } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Pressable, Text, TextInput, type TextInputInstance, View } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { FIELD_SURFACE_FILL, useFieldSurface } from "../lib/field-surface";
import { useFieldContext } from "./field";
import { Icon, type LucideIcon } from "./icon";

export const autocompleteVariants = cva("rounded-button flex-row items-center gap-2 border", {
	variants: {
		size: { sm: "min-h-10 px-3", md: "min-h-12 px-3.5", lg: "min-h-14 px-4" },
		state: { default: "border-input", loading: "border-input opacity-60", disabled: "border-input opacity-60", error: "border-destructive" },
		surface: { page: FIELD_SURFACE_FILL.page, card: FIELD_SURFACE_FILL.card, popover: FIELD_SURFACE_FILL.popover },
	},
	defaultVariants: { size: "md", state: "default", surface: "page" },
});

export const autocompleteTextVariants = cva("flex-1 self-stretch font-sans text-foreground", {
	variants: { size: { sm: "text-body py-2", md: "text-body-lg py-3", lg: "text-h3 py-3.5" } },
	defaultVariants: { size: "md" },
});

export type AutocompleteSize = NonNullable<VariantProps<typeof autocompleteVariants>["size"]>;

/** One suggestion. */
export interface AutocompleteItem {
	/** What the field is filled with when it is picked. */
	readonly value: string;
	/** What the list shows (defaults to `value`). */
	readonly label?: string | undefined;
	/** A line under it (a person's team, a job title). */
	readonly description?: string | undefined;
	/** The heading it is listed under. */
	readonly group?: string | undefined;
}

/** The field's default copy; generic and overridable. */
export interface AutocompleteLabels {
	readonly clear: string;
	readonly open: string;
	readonly close: string;
	readonly empty: string;
	/** The list's name for screen readers. */
	readonly suggestions: string;
}

export const DEFAULT_AUTOCOMPLETE_LABELS: AutocompleteLabels = {
	clear: "Clear",
	open: "Show suggestions",
	close: "Hide suggestions",
	empty: "No matches",
	suggestions: "Suggestions",
};

/** Lower case without accents, so "Fenêtre" matches "fenetre". */
function fold(text: string): string {
	return text
		.normalize("NFKD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/** The default match: every word of the query appears in the item's label, value, description or group. */
export function matchesQuery(item: AutocompleteItem, query: string): boolean {
	const words = fold(query)
		.trim()
		.split(/\s+/u)
		.filter((word: string): boolean => word.length > 0);
	const haystack = fold([item.label ?? item.value, item.value, item.description ?? "", item.group ?? ""].join(" "));
	return words.every((word: string): boolean => haystack.includes(word));
}

export interface AutocompleteProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly items: readonly AutocompleteItem[];
	/** What matches a query; `null` when the caller filters `items` itself. */
	readonly filter?: ((item: AutocompleteItem, query: string) => boolean) | null | undefined;
	/** The first match is marked, and return takes it. */
	readonly autoHighlight?: boolean | undefined;
	readonly showClear?: boolean | undefined;
	readonly showTrigger?: boolean | undefined;
	/** A line at the top of the list: an async lookup's progress, its result count or its error. */
	readonly status?: string | undefined;
	/** At most this many suggestions are listed. Default 8. */
	readonly limit?: number | undefined;
	/** A glyph before the text (a search glass). */
	readonly leadingIcon?: LucideIcon | undefined;
	readonly placeholder?: string | undefined;
	readonly size?: AutocompleteSize | undefined;
	readonly invalid?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	readonly loading?: boolean | undefined;
	readonly accessibilityLabel?: string | undefined;
	readonly labels?: Partial<AutocompleteLabels> | undefined;
	readonly onFocus?: (() => void) | undefined;
	readonly onBlur?: (() => void) | undefined;
	/** Extra classes for the field and its list, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const DEFAULT_LIMIT = 8;

/** Consecutive suggestions of one group, with the group's heading (`null` outside any group). */
interface SuggestionGroup {
	readonly heading: string | null;
	readonly items: readonly AutocompleteItem[];
}

interface SuggestionRowProps {
	readonly item: AutocompleteItem;
	readonly highlighted: boolean;
	readonly onPick: (item: AutocompleteItem) => void;
}

const SuggestionRow = React.memo(function SuggestionRow({ item, highlighted, onPick }: SuggestionRowProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(item);
	}, [item, onPick]);
	const label = item.label ?? item.value;
	const selected = React.useMemo(() => ({ selected: highlighted }), [highlighted]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={item.description === undefined ? label : `${label}, ${item.description}`}
			accessibilityState={selected}
			onPress={press}
			className={cn("active:bg-surface-selected min-h-11 justify-center px-3 py-2", highlighted ? "bg-surface-selected" : undefined)}>
			<Text className="text-body font-sans text-foreground">{label}</Text>
			{item.description === undefined ? null : <Text className="text-caption font-sans text-muted-foreground">{item.description}</Text>}
		</Pressable>
	);
});

export const Autocomplete = React.memo(
	React.forwardRef<TextInputInstance, AutocompleteProps>(function Autocomplete(
		{
			value,
			onChange,
			items,
			filter = matchesQuery,
			autoHighlight = false,
			showClear = false,
			showTrigger = false,
			status,
			limit = DEFAULT_LIMIT,
			leadingIcon,
			placeholder,
			size = "md",
			invalid,
			disabled,
			loading,
			accessibilityLabel,
			labels,
			onFocus,
			onBlur,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const field = useFieldContext();
		const surface = useFieldSurface();
		const names = React.useMemo((): AutocompleteLabels => ({ ...DEFAULT_AUTOCOMPLETE_LABELS, ...labels }), [labels]);
		const state = resolveControlState({ disabled: disabled ?? field?.disabled, loading: loading ?? field?.loading, invalid: invalid ?? field?.invalid });
		const isInactive = isInactiveState(state);
		const [open, setOpen] = React.useState<boolean>(false);
		const [showAll, setShowAll] = React.useState<boolean>(false);
		const query = showAll ? "" : value;
		const matches = React.useMemo(
			(): readonly AutocompleteItem[] =>
				(filter === null || query.trim().length === 0 ? items : items.filter((item: AutocompleteItem): boolean => filter(item, query))).slice(0, limit),
			[filter, items, limit, query],
		);
		const listOpen = open && !isInactive && (showAll || value.trim().length > 0 || status !== undefined);
		const highlighted = autoHighlight ? matches.at(0) : undefined;

		const type = React.useCallback(
			(text: string): void => {
				setShowAll(false);
				setOpen(true);
				onChange(text);
			},
			[onChange],
		);
		const pick = React.useCallback(
			(item: AutocompleteItem): void => {
				onChange(item.value);
				setOpen(false);
				setShowAll(false);
			},
			[onChange],
		);
		const takeHighlighted = React.useCallback((): void => {
			if (highlighted !== undefined) {
				pick(highlighted);
			}
		}, [highlighted, pick]);
		const clear = React.useCallback((): void => {
			onChange("");
			setShowAll(false);
		}, [onChange]);
		const toggleList = React.useCallback((): void => {
			setOpen(!listOpen);
			setShowAll(!listOpen);
		}, [listOpen]);
		const focus = React.useCallback((): void => {
			setOpen(true);
			onFocus?.();
		}, [onFocus]);

		const groups = React.useMemo((): readonly SuggestionGroup[] => {
			const result: { heading: string | null; items: AutocompleteItem[] }[] = [];
			for (const item of matches) {
				const heading = item.group ?? null;
				const last = result.at(-1);
				if (last?.heading === heading) {
					last.items.push(item);
				} else {
					result.push({ heading, items: [item] });
				}
			}
			return result;
		}, [matches]);
		const expanded = React.useMemo(() => ({ expanded: listOpen }), [listOpen]);
		return (
			<View className={cn("gap-1.5", className)}>
				<View className={autocompleteVariants({ size, state, surface })}>
					{leadingIcon === undefined ? null : <Icon icon={leadingIcon} size="sm" colorClassName="accent-icon" />}
					<TextInput
						ref={ref}
						value={value}
						onChangeText={type}
						onFocus={focus}
						onBlur={onBlur}
						onSubmitEditing={takeHighlighted}
						editable={!isInactive}
						autoCorrect={false}
						autoCapitalize="none"
						returnKeyType={highlighted === undefined ? "done" : "go"}
						placeholder={placeholder}
						placeholderTextColorClassName="accent-muted-foreground"
						accessibilityLabel={accessibilityLabel ?? field?.label}
						accessibilityHint={field?.hint}
						accessibilityState={expanded}
						testID={testID}
						className={autocompleteTextVariants({ size })}
					/>
					{showClear && value.length > 0 && !isInactive ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={names.clear}
							onPress={clear}
							hitSlop={8}
							className="active:bg-surface-selected size-7 items-center justify-center rounded-full">
							<Icon icon={XIcon} size="sm" colorClassName="accent-icon" />
						</Pressable>
					) : null}
					{showTrigger ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={listOpen ? names.close : names.open}
							accessibilityState={expanded}
							disabled={isInactive}
							onPress={toggleList}
							hitSlop={8}
							className="active:bg-surface-selected size-7 items-center justify-center rounded-full">
							<Icon icon={ChevronDownIcon} size="sm" colorClassName="accent-icon" />
						</Pressable>
					) : null}
				</View>
				{listOpen ? (
					<View
						accessibilityLabel={names.suggestions}
						className="rounded-card overflow-hidden border border-border bg-popover py-1"
						testID={testID === undefined ? undefined : `${testID}-list`}>
						{status === undefined ? null : (
							<Text accessibilityLiveRegion="polite" className="text-caption px-3 py-1.5 font-sans text-muted-foreground">
								{status}
							</Text>
						)}
						{matches.length === 0 && status === undefined ? <Text className="text-body px-3 py-2 font-sans text-muted-foreground">{names.empty}</Text> : null}
						{groups.map(({ heading, items: groupItems }: SuggestionGroup, index: number): React.JSX.Element => (
							<View key={`${String(index)}-${heading ?? ""}`}>
								{heading === null ? null : (
									<Text accessibilityRole="header" className="text-overline font-sans-semibold px-3 pt-2 pb-1 text-muted-foreground uppercase">
										{heading}
									</Text>
								)}
								{groupItems.map((item: AutocompleteItem): React.JSX.Element => (
									<SuggestionRow key={item.value} item={item} highlighted={item === highlighted} onPick={pick} />
								))}
							</View>
						))}
					</View>
				) : null}
			</View>
		);
	}),
);
