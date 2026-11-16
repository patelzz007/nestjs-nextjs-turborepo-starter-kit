import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip12Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger className="cursor-not-allowed" render={<span />}>
					<Button variant="outline" disabled>
						Delete Project
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p className="text-sm">You need admin access to delete projects</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
