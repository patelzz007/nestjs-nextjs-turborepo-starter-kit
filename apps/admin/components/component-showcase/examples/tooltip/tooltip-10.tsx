import * as React from "react";
import { ArrowRightIcon, LockIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip10Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Pro feature" />}>
					<LockIcon />
				</TooltipTrigger>
				<TooltipContent className="max-w-64 p-3">
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold">Advanced Analytics</span>
							<Badge variant="success" size="sm">
								Pro
							</Badge>
						</div>
						<p className="text-xs opacity-80">Unlock detailed insights, custom reports, and real-time dashboards.</p>
						<Button size="sm" className="border border-border/40">
							Upgrade to Pro
							<ArrowRightIcon />
						</Button>
					</div>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
