import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup3Example(): React.JSX.Element {
	return (
		<div className="flex flex-col items-center justify-center gap-4">
			<ToggleGroup size="sm" defaultValue={["top"]} variant="outline">
				<ToggleGroupItem value="top">Top</ToggleGroupItem>
				<ToggleGroupItem value="bottom">Bottom</ToggleGroupItem>
			</ToggleGroup>
			<ToggleGroup defaultValue={["top"]} variant="outline">
				<ToggleGroupItem value="top">Top</ToggleGroupItem>
				<ToggleGroupItem value="bottom">Bottom</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
