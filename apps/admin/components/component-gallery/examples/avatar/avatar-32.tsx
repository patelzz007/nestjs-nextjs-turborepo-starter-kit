import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar32Example(): React.JSX.Element {
	return (
		<div className="relative w-fit">
			<Avatar className="animate-pulse ring-2 ring-success ring-offset-2 ring-offset-background">
				<AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
				<AvatarFallback>CN</AvatarFallback>
			</Avatar>
			<span className="absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-background bg-success" />
		</div>
	);
}
