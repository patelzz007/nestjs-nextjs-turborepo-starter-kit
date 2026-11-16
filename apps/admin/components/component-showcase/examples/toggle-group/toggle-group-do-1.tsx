import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroupDo1Example(): React.JSX.Element {
	return (
		<ToggleGroup aria-label="Period" defaultValue={["week"]} variant="outline">
			<ToggleGroupItem value="day">Day</ToggleGroupItem>
			<ToggleGroupItem value="week">Week</ToggleGroupItem>
			<ToggleGroupItem value="month">Month</ToggleGroupItem>
		</ToggleGroup>
	);
}
