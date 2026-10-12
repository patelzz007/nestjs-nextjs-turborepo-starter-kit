"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface PanelShellContentProps extends React.ComponentProps<"div"> {
	readonly children: React.ReactNode;
	readonly className?: string | undefined;
}

/**
 * Centered panel main column, `max-w-10xl`. On desktop inside a panel shell
 * it is narrower beside an open sidebar (88rem) and widens as the sidebar
 * collapses (104rem), easing on the sidebar's spring (styles/components.css)
 * rather than snapping when the toggle is pressed.
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
