import * as React from "react";
import { SaveIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Kbd } from "@workspace/ui/components/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger render={<Button variant="outline" size="icon-sm" aria-label="Save" />}>
					<SaveIcon />
				</TooltipTrigger>
				<TooltipContent className="pr-1.5">
					<div className="flex items-center gap-2 text-sm">
						Save Changes <Kbd>S</Kbd>
					</div>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
