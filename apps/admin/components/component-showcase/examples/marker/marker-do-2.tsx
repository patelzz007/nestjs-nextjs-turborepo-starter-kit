import * as React from "react";
import { Marker, MarkerContent } from "@workspace/ui/components/marker";
import { Badge } from "@workspace/ui/components/badge";

export function MarkerDo2Example(): React.JSX.Element {
	return (
		<Marker className="w-full max-w-sm">
			<MarkerContent className="flex items-center gap-2">
				Ran the test suite
				<Badge variant="destructive-light">2 failed</Badge>
			</MarkerContent>
		</Marker>
	);
}
