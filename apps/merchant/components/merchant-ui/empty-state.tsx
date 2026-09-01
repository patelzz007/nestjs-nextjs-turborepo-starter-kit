import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface MerchantEmptyStateProps {
	readonly title: string;
	readonly description: string;
	readonly icon: React.ReactNode;
	readonly action?: React.ReactNode;
	readonly className?: string;
}

/** Centered empty state with icon and optional CTA. */
export function MerchantEmptyState({ title, description, icon, action, className }: MerchantEmptyStateProps): React.JSX.Element {
	return (
		<div className={cn("flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center", className)}>
			<div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-primary">{icon}</div>
			<h2 className="text-base font-semibold text-foreground">{title}</h2>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
			{action !== undefined ? <div className="mt-6">{action}</div> : null}
		</div>
	);
}
