import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Kbd } from "@workspace/ui/components/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Button54Example(): React.JSX.Element {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button variant="outline" size="icon" aria-label="Search">
						<SearchIcon />
					</Button>
				}
			/>
			<TooltipContent className="flex items-center gap-3">
				Search
				<Kbd className="-mr-1">⌘K</Kbd>
			</TooltipContent>
		</Tooltip>
	);
}
