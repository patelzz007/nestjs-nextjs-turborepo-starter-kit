import * as React from "react";
import { Columns2Icon, LayoutGridIcon, ListIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup8Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup defaultValue={["list"]} variant="outline">
				<ToggleGroupItem value="list" aria-label="List view">
					<ListIcon />
				</ToggleGroupItem>
				<ToggleGroupItem value="grid" aria-label="Grid view">
					<LayoutGridIcon />
				</ToggleGroupItem>
				<ToggleGroupItem value="kanban" aria-label="Kanban view">
					<Columns2Icon />
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
