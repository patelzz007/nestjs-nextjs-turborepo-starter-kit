"use client";

import { useSidebar } from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface PanelShellContentProps extends React.ComponentProps<"div"> {
	readonly children: React.ReactNode;
	readonly className?: string | undefined;
}

/**
 * Centered panel main column — wider when the desktop sidebar is collapsed
 * (`max-w-10xl`), narrower when the rail is open (`max-w-8xl` on lg+).
 */
export const PanelShellContent = React.forwardRef<HTMLDivElement, PanelShellContentProps>(function PanelShellContent(
	{ children, className, ...props },
	ref,
): React.JSX.Element {
	const { open } = useSidebar();

	return (
		<div
			ref={ref}
			data-slot="panel-shell-content"
			className={cn("mx-auto w-full px-4 py-6 sm:px-6 sm:py-8", open ? "max-w-10xl lg:max-w-8xl" : "max-w-10xl", className)}
			{...props}>
			{children}
		</div>
	);
});
