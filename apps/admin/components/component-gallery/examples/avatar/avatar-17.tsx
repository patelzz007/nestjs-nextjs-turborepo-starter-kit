import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar17Example(): React.JSX.Element {
	return (
		<Avatar>
			<AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" className="grayscale" />
			<AvatarFallback>CN</AvatarFallback>
		</Avatar>
	);
}
