"use client";

import { USER_DETAIL_PAGE_BUTTON_CLASS } from "@/components/users/user-detail-button";
import { Button } from "@workspace/ui/components/form/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/navigation/collapsible";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import * as React from "react";

export interface AccessHierarchySectionProps {
	readonly title: string;
	readonly count?: number;
	readonly description?: string;
	readonly defaultOpen?: boolean;
	readonly children: React.ReactNode;
}

/**
 * Collapsible branch in the access hierarchy (roles, direct grants, etc.).
 */
export const AccessHierarchySection = React.forwardRef<HTMLDivElement, AccessHierarchySectionProps>(function AccessHierarchySection(
	{ title, count, description, defaultOpen = true, children },
	ref,
): React.JSX.Element {
	const [open, setOpen] = React.useState(defaultOpen);
	const countLabel = count !== undefined ? ` (${String(count)})` : "";

	return (
		<Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card" ref={ref}>
			<CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/50 [&[data-panel-open]]:bg-muted/30">
				<ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
				<span className="flex-1">
					{title}
					{countLabel}
				</span>
			</CollapsibleTrigger>
			{description !== undefined ? <p className="px-3 pb-2 text-xs text-muted-foreground">{description}</p> : null}
			<CollapsibleContent className="border-t px-4 py-4">
				<div className="space-y-4">{children}</div>
			</CollapsibleContent>
		</Collapsible>
	);
});

export interface AccessHierarchyRowProps {
	readonly label: string;
	readonly description?: string | null;
	readonly mono?: boolean;
	readonly onRemove?: () => void;
	readonly removeDisabled?: boolean;
	readonly depth?: number;
}

/**
 * Leaf row in the access hierarchy — indented tree line with optional remove.
 */
export const AccessHierarchyRow = React.forwardRef<HTMLDivElement, AccessHierarchyRowProps>(function AccessHierarchyRow(
	{ label, description, mono = false, onRemove, removeDisabled = false, depth = 0 },
	ref,
): React.JSX.Element {
	const paddingLeft = depth > 0 ? `${String(depth * 1.25)}rem` : undefined;

	return (
		<div ref={ref} className="flex items-start justify-between gap-3 rounded-md py-1.5 pe-1" style={{ paddingLeft }}>
			<div className="min-w-0 flex-1 border-l border-border pl-3">
				<p className={`text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>{label}</p>
				{description !== undefined && description !== null && description.length > 0 ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
			</div>
			{onRemove !== undefined ? (
				<Button type="button" size="sm" className={cn("h-7 shrink-0 px-2", USER_DETAIL_PAGE_BUTTON_CLASS)} disabled={removeDisabled} onClick={onRemove}>
					Remove
				</Button>
			) : null}
		</div>
	);
});

export interface AccessHierarchyGroupProps {
	readonly title: string;
	readonly count?: number;
	readonly defaultOpen?: boolean;
	readonly children: React.ReactNode;
	readonly depth?: number;
}

/**
 * Nested group under a resource (e.g. USER → READ, UPDATE).
 */
export const AccessHierarchyGroup = React.forwardRef<HTMLDivElement, AccessHierarchyGroupProps>(function AccessHierarchyGroup(
	{ title, count, defaultOpen = true, children, depth = 0 },
	ref,
): React.JSX.Element {
	const [open, setOpen] = React.useState(defaultOpen);
	const paddingLeft = depth > 0 ? `${String(depth * 1.25)}rem` : undefined;
	const countLabel = count !== undefined ? ` (${String(count)})` : "";

	return (
		<div ref={ref} style={{ paddingLeft }}>
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted/40">
					<ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
					<span className="font-mono text-xs">
						{title}
						{countLabel}
					</span>
				</CollapsibleTrigger>
				<CollapsibleContent className="space-y-0.5 pb-1">{children}</CollapsibleContent>
			</Collapsible>
		</div>
	);
});
