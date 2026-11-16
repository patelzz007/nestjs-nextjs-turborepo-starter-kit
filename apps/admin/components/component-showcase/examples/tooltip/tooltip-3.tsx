import * as React from "react";
import { InfoIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip3Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="More information" />}>
					<InfoIcon />
				</TooltipTrigger>
				<TooltipContent>
					<p className="text-center text-sm">Additional information and help context.</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
