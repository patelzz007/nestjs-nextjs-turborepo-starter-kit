import * as React from "react";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

const PHOTO = "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80";

export function AvatarDo1Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-3 text-sm">
			<Avatar>
				<AvatarImage src={PHOTO} alt="Michael Rodriguez" />
				<AvatarFallback>MR</AvatarFallback>
				<AvatarBadge className="bg-success" aria-label="Online" />
			</Avatar>
			Michael Rodriguez · Online
		</div>
	);
}
