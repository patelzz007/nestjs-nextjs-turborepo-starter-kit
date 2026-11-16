import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup15Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup defaultValue={["asc"]} variant="outline" size="sm">
				<ToggleGroupItem value="asc" aria-label="Sort ascending">
					<ArrowUpIcon />
					Ascending
				</ToggleGroupItem>
				<ToggleGroupItem value="desc" aria-label="Sort descending">
					<ArrowDownIcon />
					Descending
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
