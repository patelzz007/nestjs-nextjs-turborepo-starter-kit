// A filter as GitHub's app shows one at the top of a list: a rounded chip with
// the current choice and a chevron; pressing it opens a sheet of the options.
// Generic over the option value, controlled and data-agnostic: `value` in,
// `onChange(next)` out. Whether the sheet is open is the chip's own display
// state.

import { cva, type VariantProps } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type NativeSyntheticEvent, type TargetedEvent } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import type { ValueHandler } from "../lib/value-handler";
import { BottomSheet, SheetOptionRow } from "./bottom-sheet";
import { Icon } from "./icon";

export const filterChipVariants = cva("flex-row items-center gap-1 self-start rounded-full border active:opacity-70", {
	variants: {
		/** `outline`: a bordered chip on the card colour. `filled`: a soft muted chip. */
		variant: {
			outline: "border-border bg-card",
			filled: "border-transparent bg-muted",
		},
		/** `md`: 36 pt tall (its touch area reaches 44 pt). `sm`: a denser 32 pt chip. */
		size: {
			md: "min-h-9 px-3.5 py-1.5",
			sm: "min-h-8 px-3 py-1",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border-destructive",
		},
	},
	defaultVariants: { variant: "outline", size: "md", state: "default" },
});

export const filterChipLabelVariants = cva("font-sans-medium text-foreground", {
	variants: {
		size: { md: "text-sm", sm: "text-xs" },
	},
	defaultVariants: { size: "md" },
});

type FilterChipVariantProps = VariantProps<typeof filterChipVariants>;
export type FilterChipVariant = NonNullable<FilterChipVariantProps["variant"]>;
export type FilterChipSize = NonNullable<FilterChipVariantProps["size"]>;

/** Extra touch area per size, so the chip reaches 44 pt (rules/04). */
const HIT_SLOP: Readonly<Record<FilterChipSize, number>> = { md: 4, sm: 6 };

export interface FilterChipOption<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
}

export interface FilterChipProps<TValue extends string> {
	/** What is being filtered — the sheet's title and part of the chip's accessible name. */
	readonly title: string;
	readonly options: readonly FilterChipOption<TValue>[];
	readonly value: NoInfer<TValue>;
	readonly onChange: ValueHandler<TValue>;
	readonly onFocus?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly onBlur?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly variant?: FilterChipVariant;
	readonly size?: FilterChipSize;
	readonly disabled?: boolean;
	/** The filtered list is reloading: blocks presses and shows a spinner. */
	readonly loading?: boolean;
	/** The caller's validation outcome. */
	readonly invalid?: boolean;
	/** What pressing does, for screen readers. */
	readonly accessibilityHint?: string;
	/** Extra classes for the chip, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** `FilterChip` keeps its option type through `memo` and `forwardRef`. The ref reaches the chip. */
export interface FilterChipComponent {
	<TValue extends string>(props: FilterChipProps<TValue> & React.RefAttributes<View>): React.ReactNode;
	displayName?: string | undefined;
}

export const FilterChip: FilterChipComponent = React.memo(
	React.forwardRef(function FilterChip(
		{
			title,
			options,
			value,
			onChange,
			onFocus,
			onBlur,
			variant = "outline",
			size = "md",
			disabled = false,
			loading = false,
			invalid = false,
			accessibilityHint = "Opens the choices",
			className,
			testID,
		}: FilterChipProps<string>,
		ref: React.ForwardedRef<View>,
	): React.JSX.Element {
		const [open, setOpen] = React.useState(false);
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const selected = options.find((option: FilterChipOption<string>): boolean => option.value === value);
		const accessibilityState = React.useMemo(() => ({ expanded: open, disabled: isInactive, busy: loading }), [isInactive, loading, open]);
		const openSheet = React.useCallback((): void => {
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
			<View>
				<Pressable
					ref={ref}
					accessibilityRole="button"
					accessibilityLabel={`${title}: ${selected?.label ?? ""}`}
					accessibilityHint={accessibilityHint}
					accessibilityState={accessibilityState}
					disabled={isInactive}
					onPress={openSheet}
					onFocus={onFocus}
					onBlur={onBlur}
					hitSlop={HIT_SLOP[size]}
					testID={testID}
					className={cn(filterChipVariants({ variant, size, state }), className)}>
					<Text className={filterChipLabelVariants({ size })}>{selected?.label ?? ""}</Text>
					{loading ? (
						<ActivityIndicator size="small" colorClassName="accent-muted-foreground" />
					) : (
						<Icon icon={ChevronDownIcon} size="sm" colorClassName="accent-muted-foreground" />
					)}
				</Pressable>
				<BottomSheet visible={open} title={title} onClose={closeSheet}>
					<View>
						{options.map((option: FilterChipOption<string>): React.JSX.Element => (
							<SheetOptionRow key={option.value} value={option.value} label={option.label} selected={option.value === value} onSelect={choose} />
						))}
					</View>
				</BottomSheet>
			</View>
		);
	}),
);
