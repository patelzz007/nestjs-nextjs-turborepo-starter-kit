import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";

export function Avatar27Example(): React.JSX.Element {
	return (
		<Button size="sm" className="gap-1 rounded-full pl-0.5">
			<Avatar className="size-6 border border-primary">
				<AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
				<AvatarFallback>CH</AvatarFallback>
			</Avatar>
			<span className="text-xs">@shadcn</span>
		</Button>
	);
}
