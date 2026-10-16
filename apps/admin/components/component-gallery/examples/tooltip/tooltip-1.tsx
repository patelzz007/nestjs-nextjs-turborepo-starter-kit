import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger render={<Button variant="outline" className="w-fit" />}>Show Tooltip</TooltipTrigger>
				<TooltipContent>
					<p className="text-sm">Add to library</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
