import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

export function Badge18Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2.5">
			<Badge size="sm">Small</Badge>
			<Badge size="default">Default</Badge>
			<Badge size="lg">Large</Badge>
		</div>
	);
}
