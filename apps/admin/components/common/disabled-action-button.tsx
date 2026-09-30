"use client";

import { Button } from "@workspace/ui/components/form/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/overlay/tooltip";
import * as React from "react";

type ButtonProps = React.ComponentProps<typeof Button>;

export interface DisabledActionButtonProps {
	/** Why the action is unavailable — shown in a tooltip and announced to screen readers. */
	readonly reason: string;
	readonly children: React.ReactNode;
	readonly variant?: ButtonProps["variant"];
	readonly size?: ButtonProps["size"];
	readonly className?: string;
}

/**
 * Presentational stand-in for an action the session may not perform: a
 * disabled button with an explanatory tooltip. Use it where hiding the action
 * would confuse (e.g. the primary "Create" button of a read-only list); prefer
 * hiding for row actions. Data-agnostic — the caller decides when to render it.
 */
export function DisabledActionButton({ reason, children, variant, size, className }: DisabledActionButtonProps): React.JSX.Element {
	const reasonId = React.useId();

	return (
		<Tooltip>
			{/* Disabled buttons swallow pointer events, so the focusable wrapper owns the tooltip. */}
			<TooltipTrigger render={<span tabIndex={0} className="inline-flex cursor-not-allowed" aria-describedby={reasonId} />}>
				<Button type="button" variant={variant} size={size} className={className} disabled aria-describedby={reasonId}>
					{children}
				</Button>
			</TooltipTrigger>
			<span id={reasonId} className="sr-only">
				{reason}
			</span>
			<TooltipContent>{reason}</TooltipContent>
		</Tooltip>
	);
}
