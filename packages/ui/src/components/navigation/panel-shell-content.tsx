"use client";

import { useSidebar } from "@workspace/ui/components/navigation/sidebar";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface PanelShellContentProps {
	readonly children: React.ReactNode;
	readonly className?: string;
}

/**
 * Centered panel main column — wider when the desktop sidebar is collapsed
 * (`max-w-10xl`), narrower when the rail is open (`max-w-8xl` on lg+).
 */
export function PanelShellContent({ children, className }: PanelShellContentProps): React.JSX.Element {
	const { open } = useSidebar();

	return <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 sm:py-8", open ? "max-w-10xl lg:max-w-8xl" : "max-w-10xl", className)}>{children}</div>;
}
