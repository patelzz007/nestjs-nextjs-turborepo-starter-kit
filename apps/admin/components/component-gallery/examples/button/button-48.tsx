import * as React from "react";
import { BellIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";

export function Button48Example(): React.JSX.Element {
	return (
		<Button size="icon" variant="outline" className="relative" aria-label="Notifications (8)">
			<BellIcon aria-hidden="true" />
			<Badge variant="destructive" size="xs" className="absolute -top-1 -right-1 rounded-full px-1" aria-hidden="true">
				8
			</Badge>
		</Button>
	);
}
