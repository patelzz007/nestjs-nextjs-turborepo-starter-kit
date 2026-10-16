import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup11Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup defaultValue={["m"]} size="sm" variant="outline">
				<ToggleGroupItem value="s">S</ToggleGroupItem>
				<ToggleGroupItem value="m">M</ToggleGroupItem>
				<ToggleGroupItem value="l">L</ToggleGroupItem>
				<ToggleGroupItem value="xl">XL</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
