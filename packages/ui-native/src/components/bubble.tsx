// A chat bubble (the web kit's `Bubble`): one message's text, or any content
// (an attachment, a picture), on a rounded surface. `sent` bubbles are the
// viewer's own — solid primary, at the trailing edge; `received` bubbles are
// someone else's — muted, at the leading edge. The bubble draws its own `text`
// in the matching colour; other content goes in as children.
//
//                     ╭──────────────╮
//                     │ On my way! ✓ │   sent: primary, trailing
//                     ╰──────────────╯
//   ╭─────────────────────╮
//   │ See you at the café │              received: muted, leading
//   ╰─────────────────────╯

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View } from "react-native";

import { cn } from "../lib/cn";

export const bubbleVariants = cva("max-w-4/5 gap-1 rounded-2xl", {
	variants: {
		variant: {
			sent: "self-end rounded-br-sm bg-primary",
			received: "self-start rounded-bl-sm bg-muted",
		},
		size: {
			sm: "px-3 py-1.5",
			md: "px-3.5 py-2",
		},
	},
	defaultVariants: { variant: "received", size: "md" },
});

export const bubbleTextVariants = cva("font-sans", {
	variants: {
		variant: {
			sent: "text-primary-foreground",
			received: "text-foreground",
		},
		size: {
			sm: "text-sm",
			md: "text-base",
		},
	},
	defaultVariants: { variant: "received", size: "md" },
});

type BubbleVariantProps = VariantProps<typeof bubbleVariants>;
export type BubbleVariant = NonNullable<BubbleVariantProps["variant"]>;
export type BubbleSize = NonNullable<BubbleVariantProps["size"]>;

export interface BubbleProps {
	/** The message's text, coloured for the bubble and selectable, so it can be copied. */
	readonly text?: string | undefined;
	/** Other content, after the text: an `Attachment`, a `CoverImage`. */
	readonly children?: React.ReactNode;
	/** `sent`: the viewer's own message. `received`: someone else's. */
	readonly variant?: BubbleVariant | undefined;
	readonly size?: BubbleSize | undefined;
	/** Overrides what screen readers say for the bubble as a whole. */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the bubble, merged last. */
	readonly className?: string | undefined;
	/** Extra classes for the text, merged last. */
	readonly textClassName?: string | undefined;
	readonly testID?: string | undefined;
}

export const Bubble = React.memo(
	React.forwardRef<View, BubbleProps>(function Bubble(
		{ text, children, variant = "received", size = "md", accessibilityLabel, className, textClassName, testID },
		ref,
	): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} accessibilityLabel={accessibilityLabel} className={cn(bubbleVariants({ variant, size }), className)}>
				{text === undefined ? null : (
					<Text selectable className={cn(bubbleTextVariants({ variant, size }), textClassName)}>
						{text}
					</Text>
				)}
				{children}
			</View>
		);
	}),
);
