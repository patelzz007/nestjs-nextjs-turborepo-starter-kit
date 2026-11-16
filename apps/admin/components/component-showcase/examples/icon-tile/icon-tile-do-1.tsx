import * as React from "react";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { ArrowDownLeftIcon } from "lucide-react";

export function IconTileDo1Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-3 text-sm">
			<IconTile tone="green" aria-hidden="true">
				<ArrowDownLeftIcon />
			</IconTile>
			Payment received
		</div>
	);
}
