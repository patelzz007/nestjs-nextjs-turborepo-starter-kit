import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar16Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-1.5">
			<Avatar>
				<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson" />
				<AvatarFallback>AJ</AvatarFallback>
			</Avatar>

			<div className="flex flex-col">
				<div className="flex items-center gap-1.5">
					<span className="text-sm font-semibold">Alex Johnson</span>
					<Badge variant="default" size="xs">
						Pro
					</Badge>
				</div>
				<span className="text-xs text-muted-foreground">Founder & CEO</span>
			</div>
		</div>
	);
}
