import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Tooltip13Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Tooltip>
				<TooltipTrigger className="relative cursor-pointer">
					<Avatar>
						<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="James Davis" />
						<AvatarFallback>JD</AvatarFallback>
					</Avatar>
					<span className="absolute right-0 bottom-0 block size-3 rounded-full border-2 border-background bg-success" />
				</TooltipTrigger>
				<TooltipContent className="flex items-center gap-2 p-2">
					<Avatar>
						<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="James Davis" />
						<AvatarFallback>JD</AvatarFallback>
					</Avatar>
					<div className="flex flex-col gap-0.5">
						<span className="text-sm font-medium">James Davis</span>
						<div className="flex items-center gap-1.5 opacity-80">
							<span className="block size-1.5 shrink-0 rounded-full bg-success" />
							Online now
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
