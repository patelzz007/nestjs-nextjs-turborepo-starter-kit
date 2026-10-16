import * as React from "react";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, MenuIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export function ToggleGroup7Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<ToggleGroup defaultValue={["left"]} spacing={1}>
				<ToggleGroupItem value="left" aria-label="Align left">
					<AlignLeftIcon />
				</ToggleGroupItem>
				<ToggleGroupItem value="center" aria-label="Align center">
					<AlignCenterIcon />
				</ToggleGroupItem>
				<ToggleGroupItem value="right" aria-label="Align right">
					<AlignRightIcon />
				</ToggleGroupItem>
				<ToggleGroupItem value="justify" aria-label="Justify">
					<MenuIcon />
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
