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
	/** Extra classes for the row, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Message = React.memo(
	React.forwardRef<ViewInstance, MessageProps>(function Message(
		{ children, variant = "received", size = "md", avatar, author, timestamp, className, testID },
		ref,
	): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(messageVariants({ variant, size }), className)}>
				{avatar === undefined ? null : <View className="shrink-0">{avatar}</View>}
				<View className={messageContentVariants({ variant, size })}>
					{author === undefined ? null : (
						<Text numberOfLines={1} className="font-sans-medium px-1 text-xs text-muted-foreground">
							{author}
						</Text>
					)}
					{children}
					{timestamp === undefined ? null : <Text className="px-1 font-sans text-xs text-muted-foreground">{timestamp}</Text>}
				</View>
			</View>
		);
	}),
);
