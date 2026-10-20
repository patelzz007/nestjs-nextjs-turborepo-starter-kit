"use client";

import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/** The panel: `DialogContent`'s box (position, padding, radius, ring), without its open/close animation. */
const dialogSkeletonVariants = cva(
	"fixed inset-s-1/2 top-1/2 z-overlay grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl bg-popover p-6 ring-1 ring-foreground/10 rtl:translate-x-1/2",
	{
		variants: {
			/** The `sm:max-w-*` the real dialog's `DialogContent` uses. */
			width: {
				md: "sm:max-w-md",
				"3xl": "sm:max-w-3xl",
				"4xl": "sm:max-w-4xl",
			},
		},
		defaultVariants: { width: "md" },
	},
);

/** The body bone's height per dialog body. */
const dialogSkeletonBodyVariants = cva("w-full rounded-lg", {
	variants: {
		body: {
			/** A short form or message. */
			sm: "h-24",
			/** An image cropper's frame. */
			media: "h-72",
			/** A document viewer (`PdfViewer`'s `h-[min(70vh,720px)]`). */
			document: "h-[min(70vh,720px)]",
		},
	},
	defaultVariants: { body: "sm" },
});

export interface DialogSkeletonProps extends VariantProps<typeof dialogSkeletonVariants>, VariantProps<typeof dialogSkeletonBodyVariants> {
	/** Per-usage override of the loading announcement (`skeletonRegion` labels). */
	readonly labels?: UiKitLabelsOverride<"skeletonRegion"> | undefined;
	readonly className?: string | undefined;
}

/**
 * An open dialog while its content's code loads (a lazily loaded dialog's
 * `loading` fallback): the kit's scrim and a panel at the dialog's width with
 * title, body and footer bones. Unlike `DialogContent` it renders in place,
 * not in a portal, so it is also what a server render outputs.
 */
export const DialogSkeleton = React.forwardRef<HTMLDivElement, DialogSkeletonProps>(function DialogSkeleton({ width, body, labels, className }, ref): React.JSX.Element {
	return (
		<SkeletonRegion ref={ref} data-slot="dialog-skeleton" labels={labels}>
			<div className="fixed inset-0 isolate z-overlay bg-scrim/10 supports-backdrop-filter:backdrop-blur-xs" />
			<div className={cn(dialogSkeletonVariants({ width }), className)}>
				<div className="flex flex-col gap-2">
					<Skeleton variant="text" className="h-5 w-48" />
					<Skeleton variant="text" className="h-4 w-full max-w-xs" />
				</div>
				<Skeleton className={dialogSkeletonBodyVariants({ body })} />
				<div className="flex justify-end gap-2">
					<Skeleton className="h-9 w-24" />
					<Skeleton className="h-9 w-24" />
				</div>
			</div>
		</SkeletonRegion>
	);
});
DialogSkeleton.displayName = "DialogSkeleton";
