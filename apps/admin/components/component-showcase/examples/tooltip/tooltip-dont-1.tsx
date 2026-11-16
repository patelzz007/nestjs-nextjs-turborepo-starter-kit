import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { InfoIcon } from "lucide-react";

export function TooltipDont1Example(): React.JSX.Element {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Info" />}>
				<InfoIcon aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent>Info</TooltipContent>
		</Tooltip>
	);
}
