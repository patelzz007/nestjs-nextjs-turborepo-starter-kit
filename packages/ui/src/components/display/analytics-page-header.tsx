"use client";

import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface AnalyticsPageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
	readonly title: string;
	readonly description: string;
	readonly actions?: React.ReactNode;
}

/** Clean analytics page title — no shell eyebrow label. */
export const AnalyticsPageHeader = React.forwardRef<HTMLDivElement, AnalyticsPageHeaderProps>(function AnalyticsPageHeader(
	{ title, description, actions, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} className={cn("flex flex-wrap items-end justify-between gap-4", className)} {...props}>
			<div className="space-y-1">
				<h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">{title}</h1>
				<p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
			</div>
			{actions !== undefined ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
		</div>
	);
});
