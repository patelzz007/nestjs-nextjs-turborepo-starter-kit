// A message block: a request error, a notice, a success. Errors are announced
// to screen readers as alerts (assertively); other tones as summaries
// (politely). Presentational: the caller passes the words, an optional title
// and glyph, and any actions as children.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";
import { BodyText } from "./text";

export const alertVariants = cva("flex-row gap-3 rounded-lg border px-4 py-3", {
	variants: {
		tone: {
			error: "border-destructive bg-destructive-soft",
			info: "border-info bg-info-soft",
			success: "border-success bg-success-soft",
			warning: "border-warning bg-warning-soft",
		},
	},
	defaultVariants: { tone: "info" },
});

/** The title's and message's colour per tone. */
export const alertTextVariants = cva("", {
	variants: {
		tone: {
			error: "text-destructive-foreground",
			info: "text-info-foreground",
			success: "text-success-foreground",
			warning: "text-warning-foreground",
		},
	},
	defaultVariants: { tone: "info" },
});

/** The glyph's colour per tone (Uniwind `accent-*` → the icon's `color`). */
export const alertIconVariants = cva("", {
	variants: {
		tone: {
			error: "accent-destructive-foreground",
			info: "accent-info-foreground",
			success: "accent-success-foreground",
			warning: "accent-warning-foreground",
		},
	},
	defaultVariants: { tone: "info" },
});

export type AlertTone = NonNullable<VariantProps<typeof alertVariants>["tone"]>;

export interface AlertProps {
	readonly tone: AlertTone;
	readonly message: string;
	/** A short heading above the message ("Payment failed"). */
	readonly title?: string;
	/** A glyph before the text; decorative — the words carry the meaning. */
	readonly icon?: LucideIcon;
	/** Actions under the message (a retry button). */
	readonly children?: React.ReactNode;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const Alert = React.memo(
	React.forwardRef<View, AlertProps>(function Alert({ tone, message, title, icon, children, className, testID }, ref): React.JSX.Element {
		const isError = tone === "error";
		const textClassName = alertTextVariants({ tone });
		return (
			<View
				ref={ref}
				accessible={children === undefined}
				accessibilityRole={isError ? "alert" : "summary"}
				accessibilityLiveRegion={isError ? "assertive" : "polite"}
				testID={testID}
				className={cn(alertVariants({ tone }), className)}>
				{icon === undefined ? null : <Icon icon={icon} size="md" colorClassName={alertIconVariants({ tone })} />}
				<View className="flex-1 gap-1">
					{title === undefined ? null : <Text className={cn("font-sans-semibold text-base", textClassName)}>{title}</Text>}
					<BodyText className={textClassName}>{message}</BodyText>
					{children === undefined ? null : <View className="mt-2 flex-row flex-wrap gap-2">{children}</View>}
				</View>
			</View>
		);
	}),
);
