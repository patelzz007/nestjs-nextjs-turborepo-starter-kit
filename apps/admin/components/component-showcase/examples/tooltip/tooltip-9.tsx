import * as React from "react";
import { AlertTriangleIcon } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip9Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Warning" />}>
					<AlertTriangleIcon />
				</TooltipTrigger>
				<TooltipContent>
					<div className="flex items-center gap-2 text-sm">
						<AlertTriangleIcon className="size-4 shrink-0" />
						This action cannot be undone
					</div>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
