"use client";

import { USER_DETAIL_PAGE_BUTTON_CLASS } from "@/contexts/identity";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface AccessHierarchyRowProps {
	readonly label: string;
	readonly description?: string | null | undefined;
	readonly mono?: boolean | undefined;
	readonly onRemove?: (() => void) | undefined;
	readonly removeDisabled?: boolean | undefined;
	readonly depth?: number | undefined;
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
