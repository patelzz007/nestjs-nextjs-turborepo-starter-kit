// A chat bubble (the web kit's `Bubble`): one message's text, or any content
// (an attachment, a picture), on a rounded surface. `sent` bubbles are the
// viewer's own — solid primary, at the trailing edge; `received` bubbles are
// someone else's — muted, at the leading edge. `tone` recolours it with the
// web's variants (secondary, tinted, outline, ghost, destructive…), `reactions`
// hang emoji pills off its edge, and `onPress` makes it a button (a quick
// reply). The bubble draws its own `text` in the matching colour; other content
// goes in as children.
//
//                     ╭──────────────╮
//                     │ On my way! ✓ │   sent: primary, trailing
//                     ╰──────────────╯
//   ╭─────────────────────╮
//   │ See you at the café │              received: muted, leading
//   ╰─────────────────────╯

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

export const bubbleVariants = cva("max-w-4/5 gap-1 rounded-2xl", {
	variants: {
		variant: {
			sent: "self-end rounded-br-sm",
			received: "self-start rounded-bl-sm",
		},
		/** The bubble's colour: `primary` (sent's default), `muted` (received's default), or one of the web's other variants. */
		tone: {
			primary: "bg-primary",
			secondary: "bg-secondary",
			muted: "bg-muted",
			tinted: "bg-primary/10",
			outline: "border border-border bg-background",
			ghost: "bg-transparent px-0",
			destructive: "bg-destructive/10",
		},
		size: {
			sm: "px-3 py-1.5",
			md: "px-3.5 py-2",
		},
	},
	defaultVariants: { variant: "received", tone: "muted", size: "md" },
});

export const bubbleTextVariants = cva("font-sans", {
	variants: {
		tone: {
			primary: "text-primary-foreground",
			secondary: "text-secondary-foreground",
			muted: "text-foreground",
			tinted: "text-foreground",
			outline: "text-foreground",
			ghost: "text-foreground",
			destructive: "text-destructive-foreground",
		},
		size: {
			sm: "text-body",
			md: "text-body-lg",
		},
	},
	defaultVariants: { tone: "muted", size: "md" },
});

type BubbleVariantProps = VariantProps<typeof bubbleVariants>;
export type BubbleVariant = NonNullable<BubbleVariantProps["variant"]>;
export type BubbleSize = NonNullable<BubbleVariantProps["size"]>;
export type BubbleTone = NonNullable<BubbleVariantProps["tone"]>;

/** An emoji reaction on a bubble: the emoji, how many gave it, and what a screen reader says ("2 people reacted with 👍"). */
export interface BubbleReaction {
	readonly key: string;
	readonly emoji: string;
	readonly count?: number | undefined;
	readonly label: string;
}

export interface BubbleProps {
	/** The message's text, coloured for the bubble and selectable, so it can be copied. */
	readonly text?: string | undefined;
	/** Other content, after the text: an `Attachment`, a `CoverImage`. */
	readonly children?: React.ReactNode;
	/** `sent`: the viewer's own message. `received`: someone else's. */
	readonly variant?: BubbleVariant | undefined;
	readonly size?: BubbleSize | undefined;
	/** The bubble's colour; by default primary when sent and muted when received. */
	readonly tone?: BubbleTone | undefined;
	/** Emoji pills hanging off the bubble's lower edge. */
	readonly reactions?: readonly BubbleReaction[] | undefined;
	/** Makes the bubble a button (a quick reply). */
	readonly onPress?: (() => void) | undefined;
	/** Overrides what screen readers say for the bubble as a whole. */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the bubble, merged last. */
	readonly className?: string | undefined;
	/** Extra classes for the text, merged last. */
	readonly textClassName?: string | undefined;
	readonly testID?: string | undefined;
}

export const Bubble = React.memo(
	React.forwardRef<ViewInstance, BubbleProps>(function Bubble(
		{ text, children, variant = "received", size = "md", tone, reactions = [], onPress, accessibilityLabel, className, textClassName, testID },
		ref,
	): React.JSX.Element {
		const colour: BubbleTone = tone ?? (variant === "sent" ? "primary" : "muted");
		const body = (
			<>
				{text === undefined ? null : (
					<Text selectable={onPress === undefined} className={cn(bubbleTextVariants({ tone: colour, size }), textClassName)}>
						{text}
					</Text>
				)}
				{children}
			</>
		);
		const frame = cn(bubbleVariants({ variant, tone: colour, size }), reactions.length === 0 ? "" : "mb-3", className);
		const pills =
			reactions.length === 0 ? null : (
				<View className={cn("absolute -bottom-3 flex-row gap-1", variant === "sent" ? "right-2" : "left-2")}>
					{reactions.map((reaction: BubbleReaction): React.JSX.Element => (
						<View
							key={reaction.key}
							accessible
							accessibilityRole="image"
							accessibilityLabel={reaction.label}
							className="flex-row items-center gap-0.5 rounded-full border border-border bg-background px-1.5 py-0.5">
							<Text className="text-caption">{reaction.emoji}</Text>
							{reaction.count === undefined ? null : <Text className="text-caption font-sans-medium text-muted-foreground">{reaction.count}</Text>}
						</View>
					))}
				</View>
			);
		if (onPress !== undefined) {
			return (
				<Pressable
					ref={ref}
					testID={testID}
					accessibilityRole="button"
					accessibilityLabel={accessibilityLabel ?? text}
					onPress={onPress}
					className={cn(frame, "active:opacity-70")}>
					{body}
					{pills}
				</Pressable>
			);
		}
		return (
			<View ref={ref} testID={testID} accessibilityLabel={accessibilityLabel} className={frame}>
				{body}
				{pills}
			</View>
		);
	}),
);
