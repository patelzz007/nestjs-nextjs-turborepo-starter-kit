import * as React from "react";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar8Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2">
			<Avatar className="relative">
				<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson (away)" />
				<AvatarFallback>AJ</AvatarFallback>
				<AvatarBadge className="top-0 right-0 bg-success" />
			</Avatar>
			<Avatar className="relative">
				<AvatarImage src="https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80" alt="Sarah Chen" />
				<AvatarFallback>SC</AvatarFallback>
				<AvatarBadge className="bg-warning" />
			</Avatar>
			<Avatar className="relative">
				<AvatarImage src="https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80" alt="Michael Rodriguez" />
				<AvatarFallback>MR</AvatarFallback>
				<AvatarBadge className="top-0 right-auto left-0 bg-destructive" />
			</Avatar>
			<Avatar className="relative">
				<AvatarImage src="https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80" alt="Emma Wilson" />
				<AvatarFallback>EW</AvatarFallback>
				<AvatarBadge className="right-auto left-0 bg-info" />
			</Avatar>
		</div>
	);
}
