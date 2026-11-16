import * as React from "react";
import { Marker, MarkerContent } from "@workspace/ui/components/marker";

export function MarkerDont2Example(): React.JSX.Element {
	return (
		<Marker className="w-full max-w-sm">
			<MarkerContent className="text-destructive">Ran the test suite</MarkerContent>
		</Marker>
	);
}
