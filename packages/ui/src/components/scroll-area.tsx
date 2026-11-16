"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const scrollAreaVariants = cva("relative", {
	variants: {
		/** The area's look; one treatment today. */
		variant: { default: "" },
		/** Text size inside: `default` or `sm`. */
		size: { default: "", sm: "text-sm" },
		/** `loading` or `disabled` dims the content. */
		state: { default: "", loading: "opacity-60", disabled: "opacity-50", error: "" },
	},
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & VariantProps<typeof scrollAreaVariants>;

/** A region that scrolls inside itself with a slim, themed scrollbar, on Base UI's scroll area; scrolling stays native. Bound its size through `className`. */
const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea({ className, children, variant, size, state, ...props }, ref): React.JSX.Element {
	return (
		<ScrollAreaPrimitive.Root ref={ref} data-slot="scroll-area" className={cn(scrollAreaVariants({ variant, size, state }), className)} {...props}>
			<ScrollAreaPrimitive.Viewport
				data-slot="scroll-area-viewport"
				className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1">
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar />
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
});

/** A scrollbar; the vertical one is drawn by default. Add one with `orientation="horizontal"` for sideways scrolling. */
const ScrollBar = React.forwardRef<HTMLDivElement, ScrollAreaPrimitive.Scrollbar.Props>(function ScrollBar(
	{ className, orientation = "vertical", ...props },
	ref,
): React.JSX.Element {
	return (
		<ScrollAreaPrimitive.Scrollbar
			ref={ref}
			data-slot="scroll-area-scrollbar"
			data-orientation={orientation}
			orientation={orientation}
			className={cn(
				"flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-s data-vertical:border-s-transparent",
				className,
			)}
			{...props}>
			<ScrollAreaPrimitive.Thumb data-slot="scroll-area-thumb" className="relative flex-1 rounded-full bg-border" />
		</ScrollAreaPrimitive.Scrollbar>
	);
});

export { ScrollArea, ScrollBar, scrollAreaVariants };
