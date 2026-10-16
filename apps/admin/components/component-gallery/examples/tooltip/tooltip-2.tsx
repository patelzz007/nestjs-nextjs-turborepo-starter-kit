import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

type TooltipSide = NonNullable<React.ComponentProps<typeof TooltipContent>["side"]>;

const sides: readonly TooltipSide[] = ["inline-start", "left", "top", "bottom", "right", "inline-end"];

/** "inline-start" → "Inline start". */
function sideLabel(side: TooltipSide): string {
	const words = side.replace("-", " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function Tooltip2Example(): React.JSX.Element {
	return (
		<div className="grid max-w-xs grid-cols-3 gap-2">
			{sides.map((side: TooltipSide): React.JSX.Element => (
				<Tooltip key={side}>
					<TooltipTrigger render={<Button variant="outline" className="w-full" />}>{sideLabel(side)}</TooltipTrigger>
					<TooltipContent side={side}>
						<p className="text-sm">Add to library</p>
					</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}
