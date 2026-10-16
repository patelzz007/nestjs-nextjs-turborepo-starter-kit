import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";

export function Avatar26Example(): React.JSX.Element {
	return (
		<Button variant="outline" size="sm" className="gap-1 rounded-full pl-0.5">
			<Avatar className="size-6 border-2 border-background">
				<AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
				<AvatarFallback>CH</AvatarFallback>
			</Avatar>
			<span className="text-xs">@shadcn</span>
		</Button>
	);
}
