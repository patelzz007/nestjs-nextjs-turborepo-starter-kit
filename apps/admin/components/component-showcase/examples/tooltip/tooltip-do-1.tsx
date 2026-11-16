import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { HistoryIcon } from "lucide-react";

export function TooltipDo1Example(): React.JSX.Element {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Version history" />}>
				<HistoryIcon aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent>See and restore earlier versions</TooltipContent>
		</Tooltip>
	);
}
