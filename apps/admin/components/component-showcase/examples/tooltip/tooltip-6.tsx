import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip6Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger render={<Button variant="outline" className="w-fit" />}>System Status</TooltipTrigger>
				<TooltipContent className="p-2">
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-4">
							<span className="font-medium">API</span>
							<Badge variant="success" size="sm">
								Operational
							</Badge>
						</div>
						<div className="flex items-center justify-between gap-4">
							<span className="font-medium">Database</span>
							<Badge variant="info" size="sm">
								Operational
							</Badge>
						</div>
						<div className="flex items-center justify-between gap-4">
							<span className="font-medium">CDN</span>
							<Badge variant="warning" size="sm">
								Degraded
							</Badge>
						</div>
						<p className="text-[10px] opacity-80">Updated 2 min ago</p>
					</div>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
