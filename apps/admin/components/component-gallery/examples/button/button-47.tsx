import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";

export function Button47Example(): React.JSX.Element {
	return (
		<Button aria-label="Updates (new)">
			Updates
			<Badge variant="success" size="xs" aria-hidden="true">
				New
			</Badge>
		</Button>
	);
}
