import * as React from "react";
import { PinIcon } from "lucide-react";
import { Toggle } from "@workspace/ui/components/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Toggle12Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger render={<Toggle variant="outline" aria-label="Pin to sidebar" />}>
					<PinIcon />
				</TooltipTrigger>
				<TooltipContent>
					<p className="text-sm">Pin to sidebar</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
