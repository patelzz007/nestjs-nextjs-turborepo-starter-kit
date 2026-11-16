import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";

export function Avatar19Example(): React.JSX.Element {
	return (
		<Button variant="outline" size="sm" className="gap-1.5">
			<Avatar className="size-5">
				<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&h=128&q=80" alt="@nick.bold" />
				<AvatarFallback>CH</AvatarFallback>
			</Avatar>
			<span className="text-xs">@nick.bold</span>
		</Button>
	);
}
