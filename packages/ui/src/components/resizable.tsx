"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import * as ResizablePrimitive from "react-resizable-panels";

/** Lays out panels and handles side by side (`horizontal`) or stacked (`vertical`), on `react-resizable-panels`. Panels and handles must be its direct children. */
const ResizablePanelGroup = React.forwardRef<HTMLDivElement, ResizablePrimitive.GroupProps>(function ResizablePanelGroup({ className, ...props }, ref): React.JSX.Element {
	return (
		<ResizablePrimitive.Group
			elementRef={ref}
			data-slot="resizable-panel-group"
			className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
			{...props}
		/>
	);
});

/** One pane. `defaultSize`, `minSize` and `maxSize` take pixels as a number or a share as a string (`"30%"`). */
const ResizablePanel = React.forwardRef<HTMLDivElement, ResizablePrimitive.PanelProps>(function ResizablePanel(props, ref): React.JSX.Element {
	return <ResizablePrimitive.Panel elementRef={ref} data-slot="resizable-panel" {...props} />;
});

interface ResizableHandleProps extends ResizablePrimitive.SeparatorProps {
	/** Show a visible grip in the middle of the separator. */
	readonly withHandle?: boolean;
}

/** The divider people drag (or move with the arrow keys) to resize the panels on either side. `withHandle` draws a grip. */
const ResizableHandle = React.forwardRef<HTMLDivElement, ResizableHandleProps>(function ResizableHandle({ withHandle, className, ...props }, ref): React.JSX.Element {
	return (
		<ResizablePrimitive.Separator
			elementRef={ref}
			data-slot="resizable-handle"
			className={cn(
				"relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:inset-s-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:inset-s-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 rtl:after:translate-x-1/2 rtl:aria-[orientation=horizontal]:after:translate-x-0 [&[aria-orientation=horizontal]>div]:rotate-90",
				className,
			)}
			{...props}>
			{withHandle ? <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" /> : null}
		</ResizablePrimitive.Separator>
	);
});

export { ResizableHandle, ResizablePanel, ResizablePanelGroup, type ResizableHandleProps };
