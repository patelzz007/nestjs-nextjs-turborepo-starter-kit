import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { LayoutGridIcon, ListIcon } from "lucide-react";

export function ToggleGroupDo2Example(): React.JSX.Element {
	return (
		<ToggleGroup aria-label="Layout" defaultValue={["grid"]} variant="outline">
			<ToggleGroupItem value="grid" aria-label="Grid">
				<LayoutGridIcon aria-hidden="true" />
			</ToggleGroupItem>
			<ToggleGroupItem value="list" aria-label="List">
				<ListIcon aria-hidden="true" />
			</ToggleGroupItem>
		</ToggleGroup>
	);
}
