import { Badge } from "@workspace/ui-native/components/badge";
import { Marker, MarkerContent } from "@workspace/ui-native/components/marker";
import * as React from "react";

const LINE = "Type check failed in src/db/schema.ts";

export function MarkerDo2Example(): React.JSX.Element {
	return (
		<Marker>
			<MarkerContent>{LINE}</MarkerContent>
			<Badge label="failed" tone="destructive" variant="light" size="sm" />
		</Marker>
	);
}
