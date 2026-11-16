import * as React from "react";
import { FileTextIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip14Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">
						<div className="flex items-center gap-1">
							<FileTextIcon className="size-4" aria-hidden="true" />
							<span className="text-sm">report-q4.pdf</span>
						</div>
					</TooltipTrigger>
					<TooltipContent className="p-3">
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
									<FileTextIcon className="size-4 text-muted-foreground" aria-hidden="true" />
								</div>
								<div className="flex flex-col gap-0.5">
									<span className="font-medium">report-q4.pdf</span>
									<span className="opacity-80">2.4 MB &middot; Uploaded 3 days ago</span>
								</div>
							</div>
							<div className="flex items-center gap-1.5">
								<Badge variant="info" size="xs">
									PDF
								</Badge>
								<Badge variant="success" size="xs">
									Verified
								</Badge>
							</div>
						</div>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}
