import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { LayoutGridIcon, ListIcon } from "lucide-react";

export function ToggleGroupDont2Example(): React.JSX.Element {
	return (
		<ToggleGroup defaultValue={["grid"]} variant="outline">
			<ToggleGroupItem value="grid" aria-label="Option 1">
				<LayoutGridIcon aria-hidden="true" />
			</ToggleGroupItem>
			<ToggleGroupItem value="list" aria-label="Option 2">
				<ListIcon aria-hidden="true" />
			</ToggleGroupItem>
		</ToggleGroup>
	);
}
