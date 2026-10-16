// Ported from shadcn/ui (base-vega `trace`): a compact activity log — one
// line per step, optionally collapsible to reveal its detail. Part names,
// `data-slot` values and the `status` prop match shadcn, so its docs and
// examples apply, with these deliberate deviations:
// - Every part forwards its ref.
// - `TraceLine`'s `status` styling is a CVA axis (`traceLineVariants`); the
//   `data-status` attribute stays, since the collapsible trigger keys its
//   error tint off it.
// - The chevron is lucide's `ChevronRightIcon` (shadcn's icon placeholder
//   resolves to it for this kit).
"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { ChevronRightIcon } from "lucide-react";
import * as React from "react";

/** A trace step's lifecycle: running (shimmering title), failed, or not yet started. No status = done. */
type TraceLineStatus = "running" | "error" | "pending";

const traceLineVariants = cva(
	"flex w-fit max-w-full min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors in-[a,button]:cursor-pointer in-[a:hover,button:hover]:text-foreground",
	{
		variants: {
			status: {
				default: "",
				running: "*:data-[slot=trace-title]:shimmer",
				error: "text-destructive in-[a:hover,button:hover]:text-destructive",
				pending: "opacity-60",
			},
		},
		defaultVariants: {
			status: "default",
		},
	},
);

/** The log: a column of `TraceLine`s and `TraceCollapsible`s. A line's interactive wrapper (link, button) gets a focus ring. */
const Trace = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function Trace({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="trace"
			className={cn(
				"flex w-full min-w-0 flex-col gap-2 *:has-[>[data-slot=trace-line]]:flex *:has-[>[data-slot=trace-line]]:w-fit *:has-[>[data-slot=trace-line]]:max-w-full *:has-[>[data-slot=trace-line]]:min-w-0 *:has-[>[data-slot=trace-line]]:rounded-md *:has-[>[data-slot=trace-line]]:text-left *:has-[>[data-slot=trace-line]]:outline-none *:has-[>[data-slot=trace-line]]:focus-visible:ring-3 *:has-[>[data-slot=trace-line]]:focus-visible:ring-ring/50",
				className,
			)}
			{...props}
		/>
	);
});

interface TraceLineProps extends React.ComponentProps<"span"> {
	readonly status?: TraceLineStatus | undefined;
}

/** One step: icon + title + description. */
const TraceLine = React.forwardRef<HTMLSpanElement, TraceLineProps>(function TraceLine({ className, status, ...props }, ref): React.JSX.Element {
	return <span ref={ref} data-slot="trace-line" data-status={status} className={cn(traceLineVariants({ status: status ?? "default" }), className)} {...props} />;
});

/** A 16px decorative icon slot (`aria-hidden`). After a title it tucks in closer. */
const TraceIcon = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function TraceIcon({ className, ...props }, ref): React.JSX.Element {
	return (
		<span
			ref={ref}
			data-slot="trace-icon"
			aria-hidden="true"
			className={cn(
				"flex size-4 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [[data-slot=trace-title]~&]:-ml-1",
				className,
			)}
			{...props}
		/>
	);
});

/** The step's name; truncates, and shimmers while the line is `running` (not under reduced motion). */
const TraceTitle = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function TraceTitle({ className, ...props }, ref): React.JSX.Element {
	return <span ref={ref} data-slot="trace-title" className={cn("min-w-0 truncate motion-reduce:shimmer-none", className)} {...props} />;
});

/** Secondary detail (a duration, a count) in tabular figures. */
const TraceDescription = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function TraceDescription({ className, ...props }, ref): React.JSX.Element {
	return <span ref={ref} data-slot="trace-description" className={cn("shrink-0 text-muted-foreground/70 tabular-nums", className)} {...props} />;
});

type CollapsibleRootProps = React.ComponentProps<typeof Collapsible>;

/** Uncontrolled (`defaultOpen`), or controlled — then `open` and `onOpenChange` come together. */
type TraceCollapsibleProps = Omit<CollapsibleRootProps, "open"> &
	(
		| { readonly open?: undefined }
		| {
				readonly open: boolean;
				readonly onOpenChange: NonNullable<CollapsibleRootProps["onOpenChange"]>;
		  }
	);

/** A step whose detail expands below it. */
const TraceCollapsible = React.forwardRef<HTMLDivElement, TraceCollapsibleProps>(function TraceCollapsible({ className, ...props }, ref): React.JSX.Element {
	return <Collapsible ref={ref} data-slot="trace-collapsible" className={cn("flex w-full min-w-0 flex-col", className)} {...props} />;
});

/** The step's line as a toggle: its children (usually a `TraceLine`) followed by a chevron that turns when open. */
const TraceCollapsibleTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof CollapsibleTrigger>>(function TraceCollapsibleTrigger(
	{ className, children, ...props },
	ref,
): React.JSX.Element {
	return (
		<CollapsibleTrigger
			ref={ref}
			data-slot="trace-collapsible-trigger"
			className={cn(
				"group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-md text-left text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 has-[[data-status=error]]:text-destructive",
				className,
			)}
			{...props}>
			{children}
			<TraceIcon className="transition-transform group-aria-expanded/trace-collapsible-trigger:rotate-90">
				<ChevronRightIcon />
			</TraceIcon>
		</CollapsibleTrigger>
	);
});

/**
 * The step's detail, indented under a rule. The panel animates its height;
 * `className` styles the indented inner block (as in shadcn).
 */
const TraceCollapsibleContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof CollapsibleContent>>(function TraceCollapsibleContent(
	{ className, children, ...props },
	ref,
): React.JSX.Element {
	return (
		<CollapsibleContent
			ref={ref}
			data-slot="trace-collapsible-content"
			className="h-(--collapsible-panel-height) min-w-0 overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0"
			{...props}>
			<div
				data-slot="trace-collapsible-content-inner"
				className={cn("mt-2 mb-1 ml-[calc(--spacing(2)-1px)] min-w-0 border-l pr-1 pl-4 leading-relaxed wrap-break-word text-muted-foreground", className)}>
				{children}
			</div>
		</CollapsibleContent>
	);
});

export {
	Trace,
	TraceLine,
	TraceIcon,
	TraceTitle,
	TraceDescription,
	TraceCollapsible,
	TraceCollapsibleTrigger,
	TraceCollapsibleContent,
	traceLineVariants,
	type TraceLineProps,
	type TraceLineStatus,
	type TraceCollapsibleProps,
};
