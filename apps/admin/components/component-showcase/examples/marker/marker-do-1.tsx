import * as React from "react";
import { Marker, MarkerContent } from "@workspace/ui/components/marker";

export function MarkerDo1Example(): React.JSX.Element {
	return (
		<Marker className="w-full max-w-sm">
			<MarkerContent>Ran the test suite: 1,401 passed</MarkerContent>
		</Marker>
	);
}
