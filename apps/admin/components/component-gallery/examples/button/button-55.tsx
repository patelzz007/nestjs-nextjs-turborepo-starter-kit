import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";

export function Button55Example(): React.JSX.Element {
	return (
		<Button>
			<Avatar className="size-5">
				<AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
				<AvatarFallback>CH</AvatarFallback>
			</Avatar>
			<span className="text-xs">@shadcn</span>
		</Button>
	);
}
