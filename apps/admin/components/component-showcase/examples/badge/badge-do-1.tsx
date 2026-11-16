import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

export function BadgeDo1Example(): React.JSX.Element {
	return (
		<div className="flex gap-2">
			<Badge variant="success-light">Paid</Badge>
			<Badge variant="destructive-light">Overdue</Badge>
		</div>
	);
}
