"use client";

import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** Swallows the click of an unavailable action. */
function preventAction(event: React.MouseEvent<HTMLButtonElement>): void {
	event.preventDefault();
}

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

	// `aria-disabled` (not `disabled`): the button stays focusable, so keyboard and
	// pointer users can both reach the tooltip that explains why it is unavailable;
	// the click is swallowed so it never performs the action.
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant={variant}
						size={size}
						className={cn("cursor-not-allowed opacity-50", className)}
						aria-disabled="true"
						aria-describedby={reasonId}
						onClick={preventAction}>
						{children}
					</Button>
				}
			/>
			<span id={reasonId} className="sr-only">
				{reason}
			</span>
			<TooltipContent>{reason}</TooltipContent>
		</Tooltip>
	);
}
