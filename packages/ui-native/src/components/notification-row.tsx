// One notification in a feed, the way a social app lists them: a round
// picture on the left (who it is from, with a small glyph on its corner saying
// what kind of notice it is — or the glyph alone, large, when it is from the
// app itself), the title in bold running into the message, and how long ago
// under it. An unread one is tinted, its time in the brand colour, with a dot
// at the end. The whole row is one button (open it); `trailing` holds the
// row's own menu ("…"), outside that button so the two never swallow each
// other's taps.
//
// Presentational and controlled: the caller passes the words, the picture,
// the glyph and tone, and the clock (`now`, a screen-level tick), so the time
// only moves when the caller ticks.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { type GestureResponderEvent, Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Avatar } from "./avatar";
import { Icon, type LucideIcon } from "./icon";
import { iconTileGlyphVariants, iconTileVariants, type IconTileTone } from "./icon-tile";
import { RelativeTime, SHORT_RELATIVE_TIME_LABELS, formatRelativeTime } from "./relative-time";

export const notificationRowVariants = cva("flex-row items-center rounded-xl pe-1", {
	variants: {
		/** An unread notice is tinted, so the new ones stand out of a long list at a glance. */
		unread: { true: "bg-primary/10", false: "" },
	},
	defaultVariants: { unread: false },
});

export const notificationRowMessageVariants = cva("font-sans text-base leading-snug", {
	variants: {
		unread: { true: "text-foreground", false: "text-muted-foreground" },
	},
	defaultVariants: { unread: false },
});

export const notificationRowTimeVariants = cva("", {
	variants: {
		unread: { true: "font-sans-semibold text-primary", false: "" },
	},
	defaultVariants: { unread: false },
});

/** The corner glyph's solid fill per tone, and its glyph's colour on it. */
export const notificationRowBadgeVariants = cva("absolute -right-1 -bottom-1 size-7 items-center justify-center rounded-full border-2 border-background", {
	variants: {
		tone: {
			brand: "bg-primary",
			neutral: "bg-invert",
			green: "bg-tone-green",
			blue: "bg-tone-blue",
			yellow: "bg-tone-yellow",
			red: "bg-tone-red",
			orange: "bg-tone-orange",
			teal: "bg-tone-teal",
			violet: "bg-tone-violet",
		},
	},
	defaultVariants: { tone: "neutral" },
});

const BADGE_GLYPH_COLOR: Readonly<Record<IconTileTone, string>> = {
	brand: "accent-primary-foreground",
	neutral: "accent-invert-foreground",
	green: "accent-status-foreground",
	blue: "accent-status-foreground",
	yellow: "accent-status-foreground",
	red: "accent-status-foreground",
	orange: "accent-status-foreground",
	teal: "accent-status-foreground",
	violet: "accent-status-foreground",
};

export type NotificationRowTone = NonNullable<VariantProps<typeof notificationRowBadgeVariants>["tone"]>;

/** Who a notice is from: their picture, or their initials while there is none. */
export interface NotificationRowSender {
	readonly name: string;
	readonly imageUrl: string | null;
}

export interface NotificationRowProps {
	/** What happened, in bold ("New sign-in to your account"). */
	readonly title: string;
	/** The rest of the message, after the title; long ones end after three lines. */
	readonly body: string;
	/** Who sent it (a store); `null` when it is from the app itself — the glyph leads alone. */
	readonly sender: NotificationRowSender | null;
	/** What kind of notice it is (a shield for security). */
	readonly icon: LucideIcon;
	readonly tone?: NotificationRowTone;
	/** When it arrived (epoch milliseconds). */
	readonly createdAt: number;
	/** The current time (epoch milliseconds), from the caller's clock. */
	readonly now: number;
	/** BCP 47 locale of the absolute date screen readers hear ("en-MY"). */
	readonly locale: string;
	readonly unread: boolean;
	readonly onPress: (event: GestureResponderEvent) => void;
	/** The row's own controls, after it (its "…" menu). */
	readonly trailing?: React.ReactNode;
	/** Spoken before an unread row's message ("Unread"). */
	readonly unreadLabel?: string;
	readonly accessibilityHint?: string;
	/** Extra classes for the row, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

const DEFAULT_UNREAD_LABEL = "Unread";

export const NotificationRow = React.memo(
	React.forwardRef<ViewInstance, NotificationRowProps>(function NotificationRow(
		{
			title,
			body,
			sender,
			icon,
			tone = "neutral",
			createdAt,
			now,
			locale,
			unread,
			onPress,
			trailing,
			unreadLabel = DEFAULT_UNREAD_LABEL,
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const message = `${title}. ${body}`;
		const when = formatRelativeTime(createdAt, now, SHORT_RELATIVE_TIME_LABELS);
		return (
			<View ref={ref} testID={testID} className={cn(notificationRowVariants({ unread }), className)}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={unread ? `${unreadLabel}. ${message}. ${when}` : `${message}. ${when}`}
					accessibilityHint={accessibilityHint}
					onPress={onPress}
					testID={testID === undefined ? undefined : `${testID}-open`}
					className="flex-1 flex-row items-center gap-3 py-2.5 ps-3 active:opacity-70">
					<Leading sender={sender} icon={icon} tone={tone} />
					<View className="flex-1 gap-0.5">
						<Text numberOfLines={3} className={notificationRowMessageVariants({ unread })}>
							<Text className="font-sans-semibold text-foreground">{title}</Text> {body}
						</Text>
						<RelativeTime value={createdAt} now={now} locale={locale} labels={SHORT_RELATIVE_TIME_LABELS} size="sm" className={notificationRowTimeVariants({ unread })} />
					</View>
					{unread ? <View className="size-3 rounded-full bg-primary" testID={testID === undefined ? undefined : `${testID}-unread`} /> : null}
				</Pressable>
				{trailing}
			</View>
		);
	}),
);

interface LeadingProps {
	readonly sender: NotificationRowSender | null;
	readonly icon: LucideIcon;
	readonly tone: NotificationRowTone;
}

/** The sender's picture with the kind's glyph on its corner, or the glyph alone when the app sent it. */
function Leading({ sender, icon, tone }: LeadingProps): React.JSX.Element {
	if (sender === null) {
		return (
			<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className={cn(iconTileVariants({ tone, size: "lg" }), "size-14 rounded-full")}>
				<Icon icon={icon} size="lg" colorClassName={iconTileGlyphVariants({ tone })} />
			</View>
		);
	}
	return (
		<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
			<Avatar name={sender.name} imageUrl={sender.imageUrl} size="lg" />
			<View className={notificationRowBadgeVariants({ tone })}>
				<Icon icon={icon} size="sm" colorClassName={BADGE_GLYPH_COLOR[tone]} />
			</View>
		</View>
	);
}
