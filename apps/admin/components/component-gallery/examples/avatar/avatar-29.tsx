import * as React from "react";
import { PlusIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Avatar29Example(): React.JSX.Element {
	return (
		<div className="flex gap-2">
			<AvatarGroup>
				<Avatar>
					<AvatarImage src="https://github.com/leerob.png" alt="@leerob" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
					<AvatarFallback>LR</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage src="https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80" alt="emma@example.com" />
					<AvatarFallback>EW</AvatarFallback>
				</Avatar>
				<AvatarGroupCount>+5</AvatarGroupCount>
			</AvatarGroup>
			<Tooltip>
				<TooltipTrigger>
					<Button variant="outline" size="icon" className="rounded-full">
						<PlusIcon aria-hidden="true" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Add user</TooltipContent>
			</Tooltip>
		</div>
	);
}
