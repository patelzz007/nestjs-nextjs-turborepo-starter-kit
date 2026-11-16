import * as React from "react";
import { Marker, MarkerContent } from "@workspace/ui/components/marker";

// The rows sit on a wide gap because the border variant already draws its own
// pb-2 under itself. On a tight gap the three shapes stop reading as three
// separate variants and read as one block.
export function Marker1Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-6">
			<Marker>
				<MarkerContent>Read 14 files under src/billing</MarkerContent>
			</Marker>
			<Marker variant="separator">
				<MarkerContent>Planning</MarkerContent>
			</Marker>
			<Marker variant="border">
				<MarkerContent>Wrote 3 files, 128 lines changed</MarkerContent>
			</Marker>
		</div>
	);
}
