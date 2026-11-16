// Lays out the kit's `Button`s as one control: side by side or stacked, either
// attached (shared edges, inner corners squared) or spaced apart.
// Composition only — the buttons are passed as children and keep their own
// labels, events and states; the group only adds layout classes to each one
// through its `className`, which every kit component merges last. The mobile
// counterpart of the web kit's `ButtonGroup`. `ButtonGroupText` is a text cell
// joined to the buttons (a count, a readout) and `ButtonGroupSeparator` the line
// between solid buttons, whose own edges do not show one.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";

export const buttonGroupVariants = cva("", {
	variants: {
		/** `attached`: one joined control (a split action). `separated`: related buttons with a gap. */
		variant: { attached: "", separated: "" },
		orientation: { horizontal: "flex-row items-stretch", vertical: "flex-col" },
		size: { md: "", sm: "" },
	},
	compoundVariants: [
		{ variant: "separated", size: "md", className: "gap-2" },
		{ variant: "separated", size: "sm", className: "gap-1.5" },
	],
	defaultVariants: { variant: "attached", orientation: "horizontal", size: "md" },
});

type ButtonGroupVariantProps = VariantProps<typeof buttonGroupVariants>;
export type ButtonGroupVariant = NonNullable<ButtonGroupVariantProps["variant"]>;
export type ButtonGroupOrientation = NonNullable<ButtonGroupVariantProps["orientation"]>;
export type ButtonGroupSize = NonNullable<ButtonGroupVariantProps["size"]>;

type ChildPosition = "only" | "first" | "middle" | "last";

/** Squares the inner corners and drops the doubled border where attached buttons meet. */
const ATTACHED_CLASSES: Readonly<Record<ButtonGroupOrientation, Readonly<Record<ChildPosition, string>>>> = {
	horizontal: {
		only: "",
		first: "rounded-r-none",
		middle: "rounded-none border-l-0",
		last: "rounded-l-none border-l-0",
	},
	vertical: {
		only: "",
		first: "rounded-b-none",
		middle: "rounded-none border-t-0",
		last: "rounded-t-none border-t-0",
	},
};

function positionOf(index: number, count: number): ChildPosition {
	if (count === 1) {
		return "only";
	}
	if (index === 0) {
		return "first";
	}
	return index === count - 1 ? "last" : "middle";
}

/** What the group needs from a child: a kit component that merges `className` last. */
interface GroupableProps {
	readonly className?: string;
}

function isGroupable(child: React.ReactNode): child is React.ReactElement<GroupableProps> {
	return React.isValidElement<GroupableProps>(child);
}

export interface ButtonGroupProps {
	/** The kit's `Button`s (or `IconButton`s); `null` / `false` children are skipped. */
	readonly children: React.ReactNode;
	readonly variant?: ButtonGroupVariant;
	readonly orientation?: ButtonGroupOrientation;
	readonly size?: ButtonGroupSize;
	/** What the buttons do together ("Text alignment"), for screen readers. */
	readonly accessibilityLabel?: string;
	/** Extra classes for the container, merged last (layout: `self-start`). */
	readonly className?: string;
	readonly testID?: string;
}

export const ButtonGroup = React.memo(
	React.forwardRef<ViewInstance, ButtonGroupProps>(function ButtonGroup(
		{ children, variant = "attached", orientation = "horizontal", size = "md", accessibilityLabel, className, testID },
		ref,
	): React.JSX.Element {
		const items = React.Children.toArray(children).filter(isGroupable);
		return (
			<View ref={ref} role="group" accessibilityLabel={accessibilityLabel} testID={testID} className={cn(buttonGroupVariants({ variant, orientation, size }), className)}>
				{items.map((child: React.ReactElement<GroupableProps>, index: number): React.ReactElement<GroupableProps> => {
					const groupClass = variant === "attached" ? ATTACHED_CLASSES[orientation][positionOf(index, items.length)] : "";
					return React.cloneElement(child, { className: cn(groupClass, child.props.className) });
				})}
			</View>
		);
	}),
);

export const buttonGroupTextVariants = cva("min-h-12 flex-row items-center justify-center gap-2 px-4", {
	variants: {
		/** `outline`: a bordered cell beside outline buttons. `muted`: a soft filled cell. `primary`: outlined in the action colour, beside a solid button. `plain`: text only. */
		variant: {
			outline: "rounded-button border border-input bg-card",
			muted: "rounded-button border border-input bg-muted",
			primary: "rounded-button border border-primary bg-card",
			plain: "bg-transparent",
		},
		size: { md: "min-h-12 px-4", sm: "min-h-9 px-3" },
	},
	defaultVariants: { variant: "outline", size: "md" },
});

export const buttonGroupTextLabelVariants = cva("tabular-nums", {
	variants: {
		variant: { outline: "text-foreground", muted: "text-muted-foreground", primary: "text-foreground", plain: "text-muted-foreground" },
		size: { md: "text-button font-sans-medium", sm: "text-body font-sans-medium" },
	},
	defaultVariants: { variant: "outline", size: "md" },
});

type ButtonGroupTextVariantProps = VariantProps<typeof buttonGroupTextVariants>;
export type ButtonGroupTextVariant = NonNullable<ButtonGroupTextVariantProps["variant"]>;
export type ButtonGroupTextSize = NonNullable<ButtonGroupTextVariantProps["size"]>;

export interface ButtonGroupTextProps {
	/** The cell's text: a count, a unit, a readout ("1.2K", "100%"). */
	readonly label: string;
	/** A glyph before the text; decorative. */
	readonly icon?: LucideIcon | undefined;
	readonly variant?: ButtonGroupTextVariant | undefined;
	readonly size?: ButtonGroupTextSize | undefined;
	/** Extra classes, merged last (the group adds its joining classes here). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A text cell joined to the buttons beside it (a count, a readout): not pressable, read out as text. */
export const ButtonGroupText = React.memo(
	React.forwardRef<ViewInstance, ButtonGroupTextProps>(function ButtonGroupText({ label, icon, variant = "outline", size = "md", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(buttonGroupTextVariants({ variant, size }), className)}>
				{icon === undefined ? null : <Icon icon={icon} size="sm" colorClassName="accent-icon" />}
				<Text numberOfLines={1} className={buttonGroupTextLabelVariants({ variant, size })}>
					{label}
				</Text>
			</View>
		);
	}),
);

export const buttonGroupSeparatorVariants = cva("", {
	variants: {
		orientation: { horizontal: "w-px self-stretch", vertical: "h-px self-stretch" },
		/** `primary`: a faint line between solid buttons. `default`: the hairline between outline ones. */
		tone: { primary: "bg-primary-foreground/30", default: "bg-border" },
	},
	defaultVariants: { orientation: "horizontal", tone: "default" },
});

export interface ButtonGroupSeparatorProps {
	readonly orientation?: ButtonGroupOrientation | undefined;
	readonly tone?: NonNullable<VariantProps<typeof buttonGroupSeparatorVariants>["tone"]> | undefined;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The line between two joined buttons, where their own borders do not show one (solid buttons). Decorative. */
export const ButtonGroupSeparator = React.memo(
	React.forwardRef<ViewInstance, ButtonGroupSeparatorProps>(function ButtonGroupSeparator(
		{ orientation = "horizontal", tone = "default", className, testID },
		ref,
	): React.JSX.Element {
		return (
			<View
				ref={ref}
				testID={testID}
				accessible={false}
				importantForAccessibility="no-hide-descendants"
				className={cn(buttonGroupSeparatorVariants({ orientation, tone }), "rounded-none border-0", className)}
			/>
		);
	}),
);
