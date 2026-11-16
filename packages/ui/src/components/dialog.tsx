"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@workspace/ui/components/button";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { XIcon } from "lucide-react";
import * as React from "react";

// Static render targets hoisted to module scope so each render reuses one element.
const DIALOG_CORNER_CLOSE_BUTTON = <Button variant="ghost" className="absolute inset-e-4 top-4" size="icon-sm" />;
const DIALOG_FOOTER_CLOSE_BUTTON = <Button variant="outline" />;

// Root/Portal render no DOM element of their own (base-ui providers), so like
// the Select Root they intentionally stay plain functions — the ref lives on
// the parts that render DOM (Trigger/Content/Overlay/Title/…).
/** A modal window on Base UI's dialog: focus moves in and is trapped, the page behind is inert, Escape and a backdrop click close it. Controlled with `open` / `onOpenChange`. */
function Dialog({ ...props }: DialogPrimitive.Root.Props): React.JSX.Element {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/** The button that opens the dialog. Pass your `Button` through `render`. */
const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogPrimitive.Trigger.Props>(function DialogTrigger({ ...props }, ref): React.JSX.Element {
	return <DialogPrimitive.Trigger ref={ref} data-slot="dialog-trigger" {...props} />;
});

/** Moves the dialog to the end of `body`. Used by `DialogContent`. */
function DialogPortal({ ...props }: DialogPrimitive.Portal.Props): React.JSX.Element {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

/** A button that closes the dialog. Pass your `Button` through `render`. */
const DialogClose = React.forwardRef<HTMLButtonElement, DialogPrimitive.Close.Props>(function DialogClose({ ...props }, ref): React.JSX.Element {
	return <DialogPrimitive.Close ref={ref} data-slot="dialog-close" {...props} />;
});

/** The backdrop behind the dialog. Used by `DialogContent`. */
const DialogOverlay = React.forwardRef<HTMLDivElement, DialogPrimitive.Backdrop.Props>(function DialogOverlay({ className, ...props }, ref): React.JSX.Element {
	return (
		<DialogPrimitive.Backdrop
			ref={ref}
			data-slot="dialog-overlay"
			className={cn(
				"fixed inset-0 isolate z-overlay bg-scrim/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
				className,
			)}
			{...props}
		/>
	);
});

/** The dialog's window: a portal, the backdrop and the popup in one part, with a built-in close button. */
const DialogContent = React.forwardRef<
	HTMLDivElement,
	DialogPrimitive.Popup.Props & {
		/** Draws the corner close button; `false` when the footer closes the dialog. */
		showCloseButton?: boolean;
		/** Accessible name of the corner close button — overrides the provider's `dialog.close` for this usage. */
		closeLabel?: string;
	}
>(function DialogContent({ className, children, showCloseButton = true, closeLabel, ...props }, ref): React.JSX.Element {
	const labels = useUiKitLabels("dialog");
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Popup
				ref={ref}
				data-slot="dialog-content"
				className={cn(
					"fixed inset-s-1/2 top-1/2 z-overlay grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl bg-popover p-6 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-md rtl:translate-x-1/2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
					className,
				)}
				{...props}>
				{children}
				{showCloseButton ? (
					<DialogPrimitive.Close data-slot="dialog-close" render={DIALOG_CORNER_CLOSE_BUTTON}>
						<XIcon />
						<span className="sr-only">{closeLabel ?? labels.close}</span>
					</DialogPrimitive.Close>
				) : null}
			</DialogPrimitive.Popup>
		</DialogPortal>
	);
});

/** Groups the title and the description. */
const DialogHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function DialogHeader({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
});

/** The row of actions at the bottom, stacked on narrow screens. */
const DialogFooter = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		/** Adds a Close button to the footer. */
		showCloseButton?: boolean;
		/** Text of the footer close button — overrides the provider's `dialog.close` for this usage. */
		closeLabel?: string;
	}
>(function DialogFooter({ className, showCloseButton = false, closeLabel, children, ...props }, ref): React.JSX.Element {
	const labels = useUiKitLabels("dialog");
	return (
		<div ref={ref} data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props}>
			{children}
			{showCloseButton ? <DialogPrimitive.Close render={DIALOG_FOOTER_CLOSE_BUTTON}>{closeLabel ?? labels.close}</DialogPrimitive.Close> : null}
		</div>
	);
});

/** Names the dialog (`aria-labelledby`). Every dialog needs one, visually hidden if need be. */
const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogPrimitive.Title.Props>(function DialogTitle({ className, ...props }, ref): React.JSX.Element {
	return <DialogPrimitive.Title ref={ref} data-slot="dialog-title" className={cn("font-heading leading-none font-medium", className)} {...props} />;
});

/** Describes the dialog to assistive technology (`aria-describedby`). */
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
