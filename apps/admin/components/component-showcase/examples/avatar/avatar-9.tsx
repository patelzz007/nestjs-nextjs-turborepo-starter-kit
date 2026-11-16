import * as React from "react";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar9Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2">
			<Avatar className="relative rounded-md">
				<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson (away)" className="rounded-md" />
				<AvatarFallback>AJ</AvatarFallback>
				<AvatarBadge className="-top-1 -right-1 bg-success" />
			</Avatar>
			<Avatar className="relative rounded-md">
				<AvatarImage src="https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80" alt="Sarah Chen" className="rounded-md" />
				<AvatarFallback>SC</AvatarFallback>
				<AvatarBadge className="-right-1 -bottom-1 bg-warning" />
			</Avatar>
			<Avatar className="relative rounded-md">
				<AvatarImage src="https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80" alt="Michael Rodriguez" className="rounded-md" />
				<AvatarFallback>MR</AvatarFallback>
				<AvatarBadge className="-top-1 right-auto bottom-auto -left-1 bg-destructive" />
			</Avatar>
			<Avatar className="relative rounded-md">
				<AvatarImage src="https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80" alt="Emma Wilson" className="rounded-md" />
				<AvatarFallback>EW</AvatarFallback>
				<AvatarBadge className="right-auto -bottom-1 -left-1 bg-info" />
			</Avatar>
		</div>
	);
}
