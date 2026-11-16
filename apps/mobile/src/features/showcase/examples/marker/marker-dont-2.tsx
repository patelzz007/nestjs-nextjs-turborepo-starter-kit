import { Marker, MarkerContent } from "@workspace/ui-native/components/marker";
import * as React from "react";

// Only a red text colour says it failed: it is lost on anyone who cannot see the hue.
const LINE = "src/db/schema.ts";

export function MarkerDont2Example(): React.JSX.Element {
	return (
		<Marker>
			<MarkerContent className="text-destructive-foreground">{LINE}</MarkerContent>
		</Marker>
	);
}
