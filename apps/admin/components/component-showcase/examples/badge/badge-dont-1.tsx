import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

export function BadgeDont1Example(): React.JSX.Element {
	return (
		<div className="flex gap-2">
			<Badge variant="destructive-light">Paid</Badge>
			<Badge variant="success-light">Overdue</Badge>
		</div>
	);
}
