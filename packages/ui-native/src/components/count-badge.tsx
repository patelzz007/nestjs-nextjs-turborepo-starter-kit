// A count pinned to an icon's corner: the unread notifications on the
// header's bell. Presentational and controlled: the caller passes the count;
// nothing shows at zero, and a count past `max` reads "99+" so the pill keeps
// its size. Decorative — the button it sits on says the count in its
// accessible name ("Notifications, 3 unread"), so screen readers skip it.
//
// The ring takes 2 pt off each side, so each size leaves the digit a full
// line of room inside it (16 pt for `sm`), and Android's extra font padding
// is turned off: otherwise the digit sits low in the pill instead of centred.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, type TextStyle, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

/** The largest count shown as a number; more reads "99+". */
export const COUNT_BADGE_MAX = 99;

/** What the badge says: the count, or `max` and a plus past it. */
export function countBadgeText(count: number, max: number = COUNT_BADGE_MAX): string {
	return count > max ? `${String(max)}+` : String(count);
}

/** Android pads a line for accents above it, which sits the digit low: no padding, centred in its line. */
const DIGIT_STYLE = { includeFontPadding: false, textAlignVertical: "center" } satisfies TextStyle;

/** A destructive-filled pill, ringed in the page's colour so it reads apart from the glyph under it. */
export const countBadgeVariants = cva("items-center justify-center rounded-full border-2 border-background bg-destructive", {
	variants: {
		size: { sm: "h-5 min-w-5 px-1", md: "h-6 min-w-6 px-1.5" },
	},
	defaultVariants: { size: "md" },
});

export const countBadgeLabelVariants = cva("font-sans-semibold text-center text-status-foreground", {
	variants: {
		size: { sm: "text-badge-sm", md: "text-xs" },
	},
	defaultVariants: { size: "md" },
});

export type CountBadgeSize = NonNullable<VariantProps<typeof countBadgeVariants>["size"]>;

export interface CountBadgeProps {
	/** How many; nothing is drawn at zero or below. */
	readonly count: number;
	/** The largest count shown as a number (99 by default). */
	readonly max?: number;
	readonly size?: CountBadgeSize;
	/** Extra classes, merged last (where it sits: `absolute -top-1 -right-1`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const CountBadge = React.memo(
	React.forwardRef<ViewInstance, CountBadgeProps>(function CountBadge({ count, max = COUNT_BADGE_MAX, size = "md", className, testID }, ref): React.JSX.Element | null {
		if (count <= 0) {
			return null;
		}
		return (
			<View
				ref={ref}
				pointerEvents="none"
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				testID={testID}
				className={cn(countBadgeVariants({ size }), className)}>
				<Text style={DIGIT_STYLE} className={countBadgeLabelVariants({ size })}>
					{countBadgeText(count, max)}
				</Text>
			</View>
		);
	}),
);
