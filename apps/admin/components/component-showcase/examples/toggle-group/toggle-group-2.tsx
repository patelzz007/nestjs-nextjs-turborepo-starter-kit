import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup variant="outline" defaultValue={["all"]}>
				<ToggleGroupItem value="all" aria-label="Toggle all">
					All
				</ToggleGroupItem>
				<ToggleGroupItem value="missed" aria-label="Toggle missed">
					Missed
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
