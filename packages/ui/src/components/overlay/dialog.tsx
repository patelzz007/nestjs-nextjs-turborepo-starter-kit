"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { XIcon } from "lucide-react";
import * as React from "react";

// Root/Portal render no DOM element of their own (base-ui providers), so like
// the Select Root they intentionally stay plain functions — the ref lives on
// the parts that render DOM (Trigger/Content/Overlay/Title/…).
function Dialog({ ...props }: DialogPrimitive.Root.Props): React.JSX.Element {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogPrimitive.Trigger.Props>(function DialogTrigger({ ...props }, ref): React.JSX.Element {
	return <DialogPrimitive.Trigger ref={ref} data-slot="dialog-trigger" {...props} />;
});

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props): React.JSX.Element {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

const DialogClose = React.forwardRef<HTMLButtonElement, DialogPrimitive.Close.Props>(function DialogClose({ ...props }, ref): React.JSX.Element {
	return <DialogPrimitive.Close ref={ref} data-slot="dialog-close" {...props} />;
});

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogPrimitive.Backdrop.Props>(function DialogOverlay({ className, ...props }, ref): React.JSX.Element {
	return (
		<DialogPrimitive.Backdrop
			ref={ref}
			data-slot="dialog-overlay"
			className={cn(
				"fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
				className,
			)}
			{...props}
		/>
	);
});

const DialogContent = React.forwardRef<
	HTMLDivElement,
	DialogPrimitive.Popup.Props & {
		showCloseButton?: boolean;
	}
>(function DialogContent({ className, children, showCloseButton = true, ...props }, ref): React.JSX.Element {
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Popup
				ref={ref}
				data-slot="dialog-content"
				className={cn(
					"fixed start-1/2 top-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl bg-popover p-6 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-md rtl:translate-x-1/2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
					className,
				)}
				{...props}>
				{children}
				{showCloseButton ? (
					<DialogPrimitive.Close data-slot="dialog-close" render={<Button variant="ghost" className="absolute end-4 top-4" size="icon-sm" />}>
						<XIcon />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				) : null}
			</DialogPrimitive.Popup>
		</DialogPortal>
	);
});

const DialogHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function DialogHeader({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
});

const DialogFooter = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		showCloseButton?: boolean;
	}
>(function DialogFooter({ className, showCloseButton = false, children, ...props }, ref): React.JSX.Element {
	return (
		<div ref={ref} data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props}>
			{children}
			{showCloseButton ? <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close> : null}
		</div>
	);
});

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogPrimitive.Title.Props>(function DialogTitle({ className, ...props }, ref): React.JSX.Element {
	return <DialogPrimitive.Title ref={ref} data-slot="dialog-title" className={cn("font-heading leading-none font-medium", className)} {...props} />;
});

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogPrimitive.Description.Props>(function DialogDescription(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<DialogPrimitive.Description
			ref={ref}
			data-slot="dialog-description"
			className={cn("text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground", className)}
			{...props}
		/>
	);
});

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger };
