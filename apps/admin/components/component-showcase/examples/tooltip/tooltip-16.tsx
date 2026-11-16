import * as React from "react";
import { BellIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip16Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Notifications" />}>
					<div className="relative">
						<BellIcon />
						<span className="absolute -top-1 -right-1 block size-2 rounded-full bg-destructive" />
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<div className="flex flex-col gap-1.5">
						<p className="text-sm font-medium">3 new notifications</p>
						<a href="#component-tooltip" className="text-xs font-medium underline underline-offset-2">
							View all &rarr;
						</a>
					</div>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
