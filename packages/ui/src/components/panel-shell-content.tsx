"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface PanelShellContentProps extends React.ComponentProps<"div"> {
	readonly children: React.ReactNode;
	readonly className?: string | undefined;
}

/**
 * Centered panel main column, `max-w-10xl` (104rem) — the one page width web,
 * merchant, admin and the docs share. It stays the same whether the sidebar is
 * open or collapsed, so a page never reflows when the sidebar is toggled.
 */
export const PanelShellContent = React.forwardRef<HTMLDivElement, PanelShellContentProps>(function PanelShellContent(
	{ children, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} data-slot="panel-shell-content" className={cn("mx-auto w-full max-w-10xl px-4 py-6 sm:px-6 sm:py-8", className)} {...props}>
			{children}
		</div>
	);
});
