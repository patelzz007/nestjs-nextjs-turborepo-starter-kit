import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup5Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup defaultValue={["active"]} variant="outline" size="sm">
				<ToggleGroupItem value="all">All</ToggleGroupItem>
				<ToggleGroupItem value="active">Active</ToggleGroupItem>
				<ToggleGroupItem value="completed">Completed</ToggleGroupItem>
				<ToggleGroupItem value="archived">Archived</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
