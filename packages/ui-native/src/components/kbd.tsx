// A key of a hardware keyboard (the web kit's `Kbd`): a small cap with the
// key's name ("⌘", "Ctrl", "Space"), optionally led by a glyph. Phones and
// tablets with a keyboard attached (iPad, Chromebooks, Android with a
// Bluetooth keyboard) answer to shortcuts too, and this is how a screen names
// them: next to an action, in a tooltip, in a list of shortcuts. `KbdGroup`
// sets a chord's keys side by side (`Ctrl` `Shift` `P`). Presentational and
// inert: never pressable, never read out on its own — the caller names the
// shortcut in words where it matters (`accessibilityLabel` of the group).
// `tone="inverse"` is the cap inside a dark tooltip.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";

export const kbdVariants = cva("min-w-5 flex-row items-center justify-center gap-1 self-start rounded-sm", {
	variants: {
		tone: { default: "bg-muted", inverse: "bg-background/20" },
		size: { sm: "h-5 px-1", md: "h-6 px-1.5" },
	},
	defaultVariants: { tone: "default", size: "sm" },
});

export const kbdLabelVariants = cva("font-sans-medium", {
	variants: {
		tone: { default: "text-muted-foreground", inverse: "text-background" },
		size: { sm: "text-caption", md: "text-label" },
	},
	defaultVariants: { tone: "default", size: "sm" },
});

const kbdIconVariants = cva("", {
	variants: { tone: { default: "accent-muted-foreground", inverse: "accent-background" } },
	defaultVariants: { tone: "default" },
});

type KbdVariantProps = VariantProps<typeof kbdVariants>;
export type KbdTone = NonNullable<KbdVariantProps["tone"]>;
export type KbdSize = NonNullable<KbdVariantProps["size"]>;

export interface KbdProps {
	/** The key's name as printed on it ("⌘K", "Ctrl", "Enter"); empty for a key that is only its glyph. */
	readonly label: string;
	/** A glyph before the name (an arrow, a microphone); decorative. */
	readonly icon?: LucideIcon | undefined;
	readonly tone?: KbdTone;
	readonly size?: KbdSize;
	/** Extra classes for the cap, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** One key cap. */
export const Kbd = React.memo(
	React.forwardRef<ViewInstance, KbdProps>(function Kbd({ label, icon, tone = "default", size = "sm", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} accessible={false} importantForAccessibility="no-hide-descendants" className={cn(kbdVariants({ tone, size }), className)}>
				{icon === undefined ? null : <Icon icon={icon} size="xs" colorClassName={kbdIconVariants({ tone })} />}
				{label.length === 0 ? null : <Text className={kbdLabelVariants({ tone, size })}>{label}</Text>}
			</View>
		);
	}),
);

export interface KbdGroupProps {
	/** The chord's keys, in the order they are held ("Ctrl", "Shift", "P"). */
	readonly keys: readonly string[];
	/** The shortcut in words, for screen readers ("Control Shift P"); without it the group is not read out. */
	readonly accessibilityLabel?: string | undefined;
	readonly tone?: KbdTone;
	readonly size?: KbdSize;
	/** Extra classes for the group, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A chord: its keys side by side. */
export const KbdGroup = React.memo(
	React.forwardRef<ViewInstance, KbdGroupProps>(function KbdGroup({ keys, accessibilityLabel, tone = "default", size = "sm", className, testID }, ref): React.JSX.Element {
		return (
			<View
				ref={ref}
				testID={testID}
				accessible={accessibilityLabel !== undefined}
				accessibilityLabel={accessibilityLabel}
				importantForAccessibility={accessibilityLabel === undefined ? "no-hide-descendants" : "yes"}
				className={cn("flex-row items-center gap-1 self-start", className)}>
				{keys.map((key: string, index: number): React.JSX.Element => (
					<Kbd key={`${String(index)}-${key}`} label={key} tone={tone} size={size} />
				))}
			</View>
		);
	}),
);
