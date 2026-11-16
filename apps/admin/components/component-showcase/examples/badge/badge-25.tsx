import * as React from "react";
import { FlagIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

export function Badge25Example(): React.JSX.Element {
	return (
		<Badge variant="outline">
			<FlagIcon aria-hidden="true" />
			USA
		</Badge>
	);
}
