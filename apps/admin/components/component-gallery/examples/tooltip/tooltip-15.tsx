import * as React from "react";
import { TagIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip15Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">
					<div className="flex items-center gap-1.5 text-sm">
						<TagIcon className="size-3.5" aria-hidden="true" />3 labels
					</div>
				</TooltipTrigger>
				<TooltipContent className="p-3">
					<div className="flex flex-col gap-2">
						<span className="font-medium">Labels</span>
						<div className="flex items-center gap-1.5">
							<Badge variant="destructive" size="xs">
								Bug
							</Badge>
							<Badge variant="info" size="xs">
								Frontend
							</Badge>
							<Badge variant="warning" size="xs">
								High Priority
							</Badge>
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
