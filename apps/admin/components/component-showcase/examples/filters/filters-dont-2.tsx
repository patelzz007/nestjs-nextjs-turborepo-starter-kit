import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

export function FiltersDont2Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2 text-sm text-muted-foreground">
			Showing 4 invoices
			<Badge variant="outline">Filtered</Badge>
		</div>
	);
}
