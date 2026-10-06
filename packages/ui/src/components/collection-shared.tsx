"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { Loader2Icon, PlusIcon } from "lucide-react";
import * as React from "react";
import { useMemo } from "react";

/**
 * Parts shared by the Select and Combobox collections. Each takes the
 * `data-slot` of the part it renders, so both components keep their own slot
 * names while the markup stays in one place.
 */

interface CappedChildren {
	readonly visibleChildren: ReturnType<typeof React.Children.toArray>;
	readonly hiddenCount: number;
}

/**
 * Caps the visible chips at `maxChips`. `React.Children.toArray` keeps keys, so
 * the hidden chips stay selected and only their visuals are dropped; the
 * overflow count derives from the same toArray length, so fragments and keyed
 * children never skew the "+N" number.
 */
export function useCappedChildren(children: React.ReactNode, maxChips: number | undefined): CappedChildren {
	const allChildren = useMemo(() => React.Children.toArray(children), [children]);
	const visibleChildren = useMemo(() => {
		if (maxChips === undefined || allChildren.length <= maxChips) {
			return allChildren;
		}
		return allChildren.slice(0, maxChips);
	}, [allChildren, maxChips]);
	return { visibleChildren, hiddenCount: allChildren.length - visibleChildren.length };
}

interface CollectionOverflowPillProps {
	readonly slot: string;
	/** Accessible name for the collapsed "+N" pill. */
	readonly label: string;
	readonly hiddenCount: number;
}

/** The "+N" pill that stands in for the chips `useCappedChildren` hid. Renders nothing when none are hidden. */
export const CollectionOverflowPill = React.forwardRef<HTMLSpanElement, CollectionOverflowPillProps>(function CollectionOverflowPill(
	{ slot, label, hiddenCount },
	ref,
): React.JSX.Element | null {
	if (hiddenCount <= 0) {
		return null;
	}
	return (
		<span
			ref={ref}
			data-slot={slot}
			aria-label={label}
			title={label}
			className="flex h-5.5 w-fit items-center justify-center rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
			+{hiddenCount}
		</span>
	);
});

interface CollectionLoadingProps {
	readonly slot: string;
	/** The loading message — always supplied by the smart component (rule 9). */
	readonly label: string;
	readonly className?: string | undefined;
}

/** The "Loading options…" status row at the top of a list. */
export const CollectionLoading = React.forwardRef<HTMLDivElement, CollectionLoadingProps>(function CollectionLoading({ slot, label, className }, ref): React.JSX.Element {
	return (
		<div ref={ref} data-slot={slot} role="status" aria-busy="true" className={cn("flex w-full items-center gap-2 px-2 py-2 text-sm text-muted-foreground", className)}>
			<Loader2Icon aria-hidden="true" className="pointer-events-none size-4 shrink-0 motion-safe:animate-spin" />
			<span>{label}</span>
		</div>
	);
});

interface CollectionItemLabelProps {
	readonly children?: React.ReactNode;
	/** Optional secondary line under the label. */
	readonly description?: string | undefined;
}

/** An option row's label, with an optional muted description line under it. */
export const CollectionItemLabel = React.forwardRef<HTMLSpanElement, CollectionItemLabelProps>(function CollectionItemLabel(
	{ children, description },
	ref,
): React.JSX.Element {
	if (description !== undefined) {
		return (
			<span ref={ref} className="flex min-w-0 flex-col">
				<span className="truncate">{children}</span>
				<span className="truncate text-xs text-muted-foreground">{description}</span>
			</span>
		);
	}
	return (
		<span ref={ref} className="block truncate">
			{children}
		</span>
	);
});

interface CollectionEmptyActionProps {
	readonly slot: string;
	readonly label: string;
	/** Fired when the CTA is clicked. The smart component owns the outcome (rule 9/10). */
	readonly onAction: () => void;
}

/** The optional call to action under an empty-state message. */
export const CollectionEmptyAction = React.forwardRef<HTMLElement, CollectionEmptyActionProps>(function CollectionEmptyAction(
	{ slot, label, onAction },
	ref,
): React.JSX.Element {
	return (
		<Button ref={ref} type="button" variant="link" size="sm" data-slot={slot} onClick={onAction} className="h-auto gap-1 p-0 text-xs no-underline hover:underline">
			<PlusIcon className="pointer-events-none size-3.5" />
			{label}
		</Button>
	);
});
