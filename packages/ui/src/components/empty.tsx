import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/** The state shown when there is nothing to list: media, a title, a description and a next step. Grows to fill a column and centres its content. */
const Empty = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function Empty({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="empty"
			className={cn("flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-lg border-dashed p-12 text-center text-balance", className)}
			{...props}
		/>
	);
});

/** Groups the media, the title and the description. */
const EmptyHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function EmptyHeader({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="empty-header" className={cn("flex max-w-sm flex-col items-center gap-2", className)} {...props} />;
});

const emptyMediaVariants = cva("mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0", {
	variants: {
		/** `icon` puts an icon in a small muted tile; `default` leaves media unframed, for illustrations. */
		variant: {
			default: "bg-transparent",
			icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

/** An icon, an illustration or stacked previews above the title. */
const EmptyMedia = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>>(function EmptyMedia(
	{ className, variant = "default", ...props },
	ref,
): React.JSX.Element {
	return <div ref={ref} data-slot="empty-icon" data-variant={variant} className={cn(emptyMediaVariants({ variant }), className)} {...props} />;
});

/** What is missing, in a few words. */
const EmptyTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function EmptyTitle({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="empty-title" className={cn("font-heading text-lg font-medium tracking-tight", className)} {...props} />;
});

/** Why it is empty and what to do. */
const EmptyDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function EmptyDescription({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="empty-description"
			className={cn("text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary", className)}
			{...props}
		/>
	);
});

/** The actions: buttons, a search field or an upload zone. */
const EmptyContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function EmptyContent({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="empty-content" className={cn("flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance", className)} {...props} />;
});

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia, emptyMediaVariants };
