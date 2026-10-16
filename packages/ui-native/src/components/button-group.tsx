// Lays out the kit's `Button`s as one control: side by side or stacked, either
// attached (shared edges, inner corners squared) or spaced apart.
// Composition only — the buttons are passed as children and keep their own
// labels, events and states; the group only adds layout classes to each one
// through its `className`, which every kit component merges last. The mobile
// counterpart of the web kit's `ButtonGroup`.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View } from "react-native";

import { cn } from "../lib/cn";

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
	React.forwardRef<View, ButtonGroupProps>(function ButtonGroup(
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
