// A tappable row in a settings list: an optional leading glyph, a label, an
// optional value or description, and a chevron for navigation. Controlled:
// the caller says what it opens (`onPress`) and whether it is busy or
// disabled.

import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, type GestureResponderEvent, type NativeSyntheticEvent, Pressable, type TargetedEvent, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Icon, type LucideIcon } from "./icon";

export const listRowVariants = cva("flex-row items-center gap-3 active:opacity-70", {
	variants: {
		/** `default`: navigation. `destructive`: a row that removes something ("Sign out everywhere"). */
		variant: { default: "", destructive: "" },
		/** Both sizes keep the 44 pt touch target (rules/04). */
		size: { md: "min-h-12 py-3", sm: "min-h-11 py-2" },
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

export const listRowLabelVariants = cva("font-sans", {
	variants: {
		variant: { default: "text-foreground", destructive: "text-destructive-foreground" },
		size: { md: "text-base", sm: "text-sm" },
	},
	defaultVariants: { variant: "default", size: "md" },
});

const LIST_ROW_SECONDARY_SIZE: Readonly<Record<ListRowSize, string>> = { md: "text-sm", sm: "text-xs" };
const LIST_ROW_VALUE_SIZE: Readonly<Record<ListRowSize, string>> = { md: "text-base", sm: "text-sm" };

/** The leading glyph's colour per variant (Uniwind `accent-*`). */
const ICON_COLOR: Readonly<Record<ListRowVariant, string>> = {
	default: "accent-muted-foreground",
	destructive: "accent-destructive-foreground",
};

type ListRowVariantProps = VariantProps<typeof listRowVariants>;
export type ListRowVariant = NonNullable<ListRowVariantProps["variant"]>;
export type ListRowSize = NonNullable<ListRowVariantProps["size"]>;

export interface ListRowProps {
	readonly label: string;
	readonly onPress: (event: GestureResponderEvent) => void;
	readonly onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	/** The current setting, shown at the end of the row ("Dark", "On"). */
	readonly value?: string;
	readonly description?: string;
	/** Something visual under the label (coloured line counts); say what it shows in `accessibilityLabel`. */
	readonly detail?: React.ReactNode;
	/** A glyph before the label; decorative — the label names the row. */
	readonly icon?: LucideIcon;
	readonly variant?: ListRowVariant;
	readonly size?: ListRowSize;
	/** What the row opens is loading: shows a spinner in place of the chevron and blocks presses. */
	readonly loading?: boolean;
	readonly disabled?: boolean;
	/** Overrides the accessible name (defaults to the label and the value). */
	readonly accessibilityLabel?: string;
	readonly accessibilityHint?: string;
	/** Extra classes for the row, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const ListRow = React.memo(
	React.forwardRef<ViewInstance, ListRowProps>(function ListRow(
		{
			label,
			onPress,
			onFocus,
			onBlur,
			value,
			description,
			detail,
			icon,
			variant = "default",
			size = "md",
			loading = false,
			disabled = false,
			accessibilityLabel,
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);
		return (
			<Pressable
				ref={ref}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel ?? (value === undefined ? label : `${label}, ${value}`)}
				accessibilityHint={accessibilityHint}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={onPress}
				onFocus={onFocus}
				onBlur={onBlur}
				testID={testID}
				className={cn(listRowVariants({ variant, size, state }), className)}>
				{icon === undefined ? null : <Icon icon={icon} size="md" colorClassName={ICON_COLOR[variant]} />}
				<View className="flex-1 gap-0.5">
					<Text className={listRowLabelVariants({ variant, size })}>{label}</Text>
					{description === undefined ? null : <Text className={cn("font-sans text-muted-foreground", LIST_ROW_SECONDARY_SIZE[size])}>{description}</Text>}
					{detail}
				</View>
				{value === undefined ? null : <Text className={cn("font-sans text-muted-foreground", LIST_ROW_VALUE_SIZE[size])}>{value}</Text>}
				{loading ? (
					<ActivityIndicator size="small" colorClassName="accent-muted-foreground" />
				) : (
					<Icon icon={ChevronRightIcon} size="md" colorClassName="accent-muted-foreground" />
				)}
			</Pressable>
		);
	}),
);
