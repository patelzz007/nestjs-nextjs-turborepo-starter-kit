import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";

export function Button45Example(): React.JSX.Element {
	return (
		<Button variant="outline" className="gap-2" aria-label="Messages (12)">
			Messages
			<Badge variant="destructive-outline" size="sm" aria-hidden="true">
				12
			</Badge>
		</Button>
	);
}
