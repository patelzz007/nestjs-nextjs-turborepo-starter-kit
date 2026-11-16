// One message in a conversation (the web kit's `Message`): an avatar slot,
// the author's name, the message's bubbles and a timestamp. `received`
// messages read from the leading edge with the avatar first; `sent` messages
// (the viewer's own) mirror to the trailing edge. Data-agnostic: the caller
// passes the avatar (an `Avatar`), the name and the timestamp already
// formatted for the viewer's locale ("09:41", "Yesterday").
//
//   (AM)  Alex Morgan                       received
//         ╭──────────────────╮
//         │ See you at noon? │
//         ╰──────────────────╯
//         09:41

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

export const messageVariants = cva("w-full items-end", {
	variants: {
		/** `sent`: the viewer's own message, at the trailing edge. `received`: someone else's, at the leading edge. */
		variant: {
			sent: "flex-row-reverse",
			received: "flex-row",
		},
		/** `sm`: a dense thread. `md`: a conversation screen. */
		size: {
			sm: "gap-1.5",
			md: "gap-2",
		},
	},
	defaultVariants: { variant: "received", size: "md" },
});

export const messageContentVariants = cva("flex-1", {
	variants: {
		variant: {
			sent: "items-end",
			received: "items-start",
		},
		size: {
			sm: "gap-0.5",
			md: "gap-1",
		},
	},
	defaultVariants: { variant: "received", size: "md" },
});

type MessageVariantProps = VariantProps<typeof messageVariants>;
export type MessageVariant = NonNullable<MessageVariantProps["variant"]>;
export type MessageSize = NonNullable<MessageVariantProps["size"]>;

export interface MessageProps {
	/** The message's bubbles. */
	readonly children: React.ReactNode;
	readonly variant?: MessageVariant | undefined;
	readonly size?: MessageSize | undefined;
	/** The author's picture (an `Avatar`); omit it for the viewer's own messages or a continued run. */
	readonly avatar?: React.ReactNode;
	/** The author's name, shown above the bubbles. */
	readonly author?: string | undefined;
	/** When it was sent, formatted by the caller ("09:41"). */
	readonly timestamp?: string | undefined;
	/** Above the bubbles in place of the name: a name, a dot and a time; a role badge. */
	readonly header?: React.ReactNode;
	/** Under the bubbles: a delivery status ("Read"), reply actions. */
	readonly footer?: React.ReactNode;
	/** Extra classes for the row, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Message = React.memo(
	React.forwardRef<ViewInstance, MessageProps>(function Message(
		{ children, variant = "received", size = "md", avatar, author, timestamp, header, footer, className, testID },
		ref,
	): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(messageVariants({ variant, size }), className)}>
				{avatar === undefined ? null : <View className="shrink-0">{avatar}</View>}
				<View className={messageContentVariants({ variant, size })}>
					{header === undefined ? null : <View className="flex-row items-center gap-1.5 px-1">{header}</View>}
					{author === undefined ? null : (
						<Text numberOfLines={1} className="font-sans-medium text-caption px-1 text-muted-foreground">
							{author}
						</Text>
					)}
					{children}
					{timestamp === undefined ? null : <Text className="text-caption px-1 font-sans text-muted-foreground">{timestamp}</Text>}
					{footer === undefined ? null : <View className="flex-row items-center gap-1 px-1">{footer}</View>}
				</View>
			</View>
		);
	}),
);
