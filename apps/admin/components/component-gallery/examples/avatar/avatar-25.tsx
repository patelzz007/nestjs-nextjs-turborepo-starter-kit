import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar25Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-1.5 rounded-full border border-border p-0.5 shadow-sm shadow-scrim/5">
			<div className="flex -space-x-1.5">
				<Avatar className="size-7 border-2 border-background">
					<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson" />
					<AvatarFallback>AJ</AvatarFallback>
				</Avatar>
				<Avatar className="size-7 border-2 border-background">
					<AvatarImage src="https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80" alt="Sarah Chen" />
					<AvatarFallback>SC</AvatarFallback>
				</Avatar>
				<Avatar className="size-7 border-2 border-background">
					<AvatarImage src="https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80" alt="Michael Rodriguez" />
					<AvatarFallback>MR</AvatarFallback>
				</Avatar>
				<Avatar className="size-7 border-2 border-background">
					<AvatarImage src="https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80" alt="Emma Wilson" />
					<AvatarFallback>EW</AvatarFallback>
				</Avatar>
			</div>

			<p className="me-1.5 text-xs text-muted-foreground">+3</p>
		</div>
	);
}
