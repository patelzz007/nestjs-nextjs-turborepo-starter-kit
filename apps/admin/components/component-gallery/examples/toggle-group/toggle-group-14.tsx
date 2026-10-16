import * as React from "react";
import { Columns2Icon, Columns3Icon, LayoutGridIcon, SquareIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup14Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup defaultValue={["2"]} variant="outline">
				<ToggleGroupItem value="1" aria-label="1 column">
					<SquareIcon />
				</ToggleGroupItem>
				<ToggleGroupItem value="2" aria-label="2 columns">
					<Columns2Icon />
				</ToggleGroupItem>
				<ToggleGroupItem value="3" aria-label="3 columns">
					<Columns3Icon />
				</ToggleGroupItem>
				<ToggleGroupItem value="4" aria-label="4 columns">
					<LayoutGridIcon />
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
