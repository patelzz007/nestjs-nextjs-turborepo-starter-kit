import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

export function Badge20Example(): React.JSX.Element {
	return (
		<Badge variant="outline">
			<CheckIcon />
			Badge
		</Badge>
	);
}
