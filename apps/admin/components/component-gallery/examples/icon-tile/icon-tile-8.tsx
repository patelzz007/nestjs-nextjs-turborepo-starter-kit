import type * as React from "react";
import { CircleAlertIcon, CircleCheckIcon, ClockIcon, StarIcon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

// Status tiles: the kit's `tint` variant paints each tone's soft fill with its
// glyph colour, so no per-tile colour classes are needed.
export function IconTile8Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-3">
			<IconTile variant="tint" tone="brand" aria-hidden="true">
				<StarIcon />
			</IconTile>
			<IconTile variant="tint" tone="green" aria-hidden="true">
				<CircleCheckIcon />
			</IconTile>
			<IconTile variant="tint" tone="yellow" aria-hidden="true">
				<ClockIcon />
			</IconTile>
			<IconTile variant="tint" tone="red" aria-hidden="true">
				<CircleAlertIcon />
			</IconTile>
		</div>
	);
}
