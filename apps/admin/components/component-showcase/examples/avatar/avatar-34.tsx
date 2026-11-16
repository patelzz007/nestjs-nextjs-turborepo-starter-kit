import * as React from "react";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar34Example(): React.JSX.Element {
	return (
		<Avatar className="relative">
			<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson" />
			<AvatarFallback>JB</AvatarFallback>
			<AvatarBadge className="bg-success" />
			<span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border-2 border-background bg-destructive text-xs font-medium text-status-foreground">
				3
			</span>
		</Avatar>
	);
}
