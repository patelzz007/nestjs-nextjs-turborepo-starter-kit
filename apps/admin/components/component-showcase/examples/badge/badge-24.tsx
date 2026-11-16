import * as React from "react";
import { XIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";

export function Badge24Example(): React.JSX.Element {
	return (
		<Badge variant="outline">
			<Avatar className="size-3.5">
				<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" />
				<AvatarFallback>AL</AvatarFallback>
			</Avatar>
			Alex
			<Button variant="ghost" size="icon" className="size-3 hover:bg-transparent">
				<XIcon />
			</Button>
		</Badge>
	);
}
