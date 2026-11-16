import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

const OPTIONS: readonly string[] = ["Last seven days", "Last thirty days", "This quarter so far", "Previous quarter", "Year to date", "All time"];

export function ToggleGroupDont1Example(): React.JSX.Element {
	return (
		<div className="w-72">
			<ToggleGroup aria-label="Period" variant="outline" className="flex-wrap">
				{OPTIONS.map((option: string): React.JSX.Element => (
					<ToggleGroupItem key={option} value={option}>
						{option}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}
