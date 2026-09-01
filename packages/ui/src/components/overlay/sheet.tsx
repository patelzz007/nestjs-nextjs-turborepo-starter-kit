"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { XIcon } from "lucide-react";
import * as React from "react";

function Sheet({ ...props }: SheetPrimitive.Root.Props): React.JSX.Element {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetPrimitive.Trigger.Props>(function SheetTrigger({ ...props }, ref): React.JSX.Element {
	return <SheetPrimitive.Trigger ref={ref} data-slot="sheet-trigger" {...props} />;
});

const SheetClose = React.forwardRef<HTMLButtonElement, SheetPrimitive.Close.Props>(function SheetClose({ ...props }, ref): React.JSX.Element {
	return <SheetPrimitive.Close ref={ref} data-slot="sheet-close" {...props} />;
});

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props): React.JSX.Element {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

const SheetOverlay = React.forwardRef<HTMLDivElement, SheetPrimitive.Backdrop.Props>(function SheetOverlay({ className, ...props }, ref): React.JSX.Element {
	return (
		<SheetPrimitive.Backdrop
			ref={ref}
			data-slot="sheet-overlay"
			className={cn(
				"z-overlay fixed inset-0 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
				className,
			)}
			{...props}
		/>
	);
});

const SheetContent = React.forwardRef<
	HTMLDivElement,
	SheetPrimitive.Popup.Props & {
		side?: "top" | "right" | "bottom" | "left";
		showCloseButton?: boolean;
		closeLabel?: string;
	}
>(function SheetContent({ className, children, side = "right", showCloseButton = true, closeLabel = "Close", ...props }, ref): React.JSX.Element {
	return (
		<SheetPortal>
			<SheetOverlay />
			<SheetPrimitive.Popup
				ref={ref}
				data-slot="sheet-content"
				data-side={side}
				className={cn(
					"z-overlay fixed flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-10 data-[side=bottom]:data-starting-style:translate-y-10 data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-e data-[side=left]:data-ending-style:-translate-x-10 data-[side=left]:data-starting-style:-translate-x-10 data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-s data-[side=right]:data-ending-style:translate-x-10 data-[side=right]:data-starting-style:translate-x-10 data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:-translate-y-10 data-[side=top]:data-starting-style:-translate-y-10 data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm rtl:data-[side=left]:data-ending-style:translate-x-10 rtl:data-[side=left]:data-starting-style:-translate-x-10 rtl:data-[side=right]:data-ending-style:-translate-x-10 rtl:data-[side=right]:data-starting-style:-translate-x-10",
					className,
				)}
				{...props}>
				{children}
				{showCloseButton ? (
					<SheetPrimitive.Close data-slot="sheet-close" render={<Button variant="ghost" className="absolute inset-e-4 top-4" size="icon-sm" />}>
						<XIcon />
						<span className="sr-only">{closeLabel}</span>
					</SheetPrimitive.Close>
				) : null}
			</SheetPrimitive.Popup>
		</SheetPortal>
	);
});

const SheetHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function SheetHeader({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />;
});

const SheetFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function SheetFooter({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
});

const SheetTitle = React.forwardRef<HTMLHeadingElement, SheetPrimitive.Title.Props>(function SheetTitle({ className, ...props }, ref): React.JSX.Element {
	return <SheetPrimitive.Title ref={ref} data-slot="sheet-title" className={cn("font-heading font-medium text-foreground", className)} {...props} />;
});

const SheetDescription = React.forwardRef<HTMLParagraphElement, SheetPrimitive.Description.Props>(function SheetDescription({ className, ...props }, ref): React.JSX.Element {
	return <SheetPrimitive.Description ref={ref} data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
});

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
