import * as React from "react";
import { Marker, MarkerContent } from "@workspace/ui/components/marker";

export function MarkerDont1Example(): React.JSX.Element {
	return (
		<Marker className="w-full max-w-sm">
			<MarkerContent>Ran this one</MarkerContent>
		</Marker>
	);
}
