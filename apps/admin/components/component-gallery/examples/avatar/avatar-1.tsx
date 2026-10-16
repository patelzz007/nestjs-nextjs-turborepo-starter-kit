import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export function Avatar1Example(): React.JSX.Element {
	return (
		<Avatar>
			<AvatarImage src="https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80" alt="Michael Rodriguez" />
			<AvatarFallback>MR</AvatarFallback>
		</Avatar>
	);
}
