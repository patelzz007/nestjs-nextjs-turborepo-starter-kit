import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function TooltipDo2Example(): React.JSX.Element {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button aria-disabled="true" />}>Publish</TooltipTrigger>
			<TooltipContent>Add a title before publishing</TooltipContent>
		</Tooltip>
	);
}
