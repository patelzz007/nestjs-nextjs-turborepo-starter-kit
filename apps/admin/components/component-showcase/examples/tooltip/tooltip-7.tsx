import * as React from "react";
import { BadgeCheckIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip7Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<p className="text-sm">
				Verified domain{" "}
				<Tooltip>
					<TooltipTrigger className="align-middle text-muted-foreground">
						<BadgeCheckIcon className="size-4 text-success" aria-hidden="true" />
					</TooltipTrigger>
					<TooltipContent>
						<div className="flex items-center gap-2">
							<Badge variant="success" size="sm">
								Verified
							</Badge>
							<p>Domain ownership has been confirmed.</p>
						</div>
					</TooltipContent>
				</Tooltip>
			</p>
		</div>
	);
}
