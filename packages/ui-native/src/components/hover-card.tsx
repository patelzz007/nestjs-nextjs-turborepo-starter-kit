// A preview card for something named in passing — a person, a link, a
// timestamp (the web kit's `HoverCard`). A phone has no hover, so a long
// press on the trigger opens the card beside it, and a tap outside closes
// it; a plain tap stays the trigger's own (open the profile, follow the
// link). It is a Popover (./popover.tsx) opened by a long press, with a
// card's width; the trigger's hint tells screen readers the card is there.

import * as React from "react";
import type { ViewInstance } from "react-native";

import { Popover, type PopoverProps } from "./popover";

export type HoverCardProps = Omit<PopoverProps, "openOn">;

export const HoverCard = React.memo(
	React.forwardRef<ViewInstance, HoverCardProps>(function HoverCard({ size = "lg", accessibilityHint, accessibilityLabel, ...props }, ref): React.JSX.Element {
		return (
			<Popover
				ref={ref}
				{...props}
				accessibilityLabel={accessibilityLabel}
				accessibilityHint={accessibilityHint ?? `Long press to preview ${accessibilityLabel.toLowerCase()}`}
				size={size}
				openOn="longPress"
			/>
		);
	}),
);
