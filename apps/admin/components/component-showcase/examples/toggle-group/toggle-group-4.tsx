import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup variant="outline" spacing={2} defaultValue={["week"]}>
				<ToggleGroupItem value="day">Day</ToggleGroupItem>
				<ToggleGroupItem value="week">Week</ToggleGroupItem>
				<ToggleGroupItem value="month">Month</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
