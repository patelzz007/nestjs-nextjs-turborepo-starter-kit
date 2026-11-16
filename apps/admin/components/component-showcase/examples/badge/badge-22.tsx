import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

export function Badge22Example(): React.JSX.Element {
	return (
		<Badge variant="info-light">
			<span className="ms-0.25 size-1.25 rounded-full! bg-[currentColor]" /> Badge
		</Badge>
	);
}
