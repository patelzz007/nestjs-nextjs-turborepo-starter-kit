import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar13Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-3">
			<Avatar className="size-8 ring-2 ring-primary ring-offset-2 ring-offset-background">
				<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson" />
				<AvatarFallback>AJ</AvatarFallback>
			</Avatar>
			<Avatar className="size-8 ring-2 ring-destructive ring-offset-2 ring-offset-background">
				<AvatarImage src="https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80" alt="Sarah Chen" />
				<AvatarFallback>SC</AvatarFallback>
			</Avatar>
			<Avatar className="size-8 ring-2 ring-tone-violet ring-offset-2 ring-offset-background">
				<AvatarImage src="https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80" alt="Michael Rodriguez" />
				<AvatarFallback>MR</AvatarFallback>
			</Avatar>
			<Avatar className="size-8 ring-2 ring-warning ring-offset-2 ring-offset-background">
				<AvatarImage src="https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80" alt="Emma Wilson" />
				<AvatarFallback>EW</AvatarFallback>
			</Avatar>
		</div>
	);
}
