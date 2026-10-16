import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup16Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup defaultValue={["monthly"]} variant="outline" size="lg">
				<ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
				<ToggleGroupItem value="yearly" className="gap-2">
					Yearly
					<span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Save 20%</span>
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
