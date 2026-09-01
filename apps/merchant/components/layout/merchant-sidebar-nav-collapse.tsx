"use client";

import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface MerchantSidebarNavCollapseProps {
	readonly open: boolean;
	readonly children: React.ReactNode;
	readonly className?: string;
}

/** Height collapse for nested sidebar branches — children stay mounted for smooth open/close. */
export function MerchantSidebarNavCollapse({ open, children, className }: MerchantSidebarNavCollapseProps): React.JSX.Element {
	return (
		<div
			className={cn("grid w-full transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none", className)}
			style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
			<div className="min-h-0 w-full overflow-hidden [overflow-anchor:none]" inert={!open ? true : undefined}>
				<div
					className={cn(
						"w-full transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
						open ? "translate-y-0 opacity-100" : "-translate-y-0.5 opacity-0",
					)}>
					{children}
				</div>
			</div>
		</div>
	);
}
