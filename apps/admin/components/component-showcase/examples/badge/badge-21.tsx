import * as React from "react";
import { XIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";

export function Badge21Example(): React.JSX.Element {
	return (
		<Badge variant="outline" className="gap-0.5">
			Badge
			<Button variant="ghost" size="icon" className="size-3 hover:bg-transparent">
				<XIcon />
			</Button>
		</Badge>
	);
}
