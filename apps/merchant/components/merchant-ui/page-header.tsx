import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface MerchantPageHeaderProps {
	readonly title: string;
	readonly description: string;
	readonly actions?: React.ReactNode;
	readonly className?: string;
}

/** Page title block with optional right-side actions. */
export function MerchantPageHeader({ title, description, actions, className }: MerchantPageHeaderProps): React.JSX.Element {
	return (
		<div className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5", className)}>
			<div className="space-y-1">
				<p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Merchant console</p>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
				<p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
			</div>
			{actions !== undefined ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
		</div>
	);
}
