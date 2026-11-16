"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** Gap (px) between the trigger and the card. */
const HOVER_CARD_SIDE_OFFSET = 4;
/** Cross-axis nudge (px) so the card does not sit flush with the trigger edge. */
const HOVER_CARD_ALIGN_OFFSET = 4;

// Root renders no DOM element of its own (a base-ui provider), so like the
// Select Root it intentionally stays a plain function — the ref lives on the
// parts that render DOM (Trigger/Content).
/** A preview shown while a link is hovered or focused, on Base UI's preview card. */
function HoverCard({ ...props }: PreviewCardPrimitive.Root.Props): React.JSX.Element {
	return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

/** The link that shows the card. Render a real link or button through `render`; `delay` and `closeDelay` set the timing. */
const HoverCardTrigger = React.forwardRef<HTMLAnchorElement, PreviewCardPrimitive.Trigger.Props>(function HoverCardTrigger({ ...props }, ref): React.JSX.Element {
	return <PreviewCardPrimitive.Trigger ref={ref} data-slot="hover-card-trigger" {...props} />;
});

/** The card: a portal, a positioner and the popup. `side` and `align` place it. */
const HoverCardContent = React.forwardRef<
	HTMLDivElement,
	PreviewCardPrimitive.Popup.Props & Pick<PreviewCardPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
>(function HoverCardContent(
	{ className, side = "bottom", sideOffset = HOVER_CARD_SIDE_OFFSET, align = "center", alignOffset = HOVER_CARD_ALIGN_OFFSET, ...props },
	ref,
): React.JSX.Element {
	return (
		<PreviewCardPrimitive.Portal data-slot="hover-card-portal">
			<PreviewCardPrimitive.Positioner align={align} alignOffset={alignOffset} side={side} sideOffset={sideOffset} className="isolate z-popover">
				<PreviewCardPrimitive.Popup
					ref={ref}
					data-slot="hover-card-content"
					className={cn(
						"z-popover w-64 origin-(--transform-origin) rounded-lg bg-popover p-4 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					{...props}
				/>
			</PreviewCardPrimitive.Positioner>
		</PreviewCardPrimitive.Portal>
	);
});

export { HoverCard, HoverCardTrigger, HoverCardContent };
