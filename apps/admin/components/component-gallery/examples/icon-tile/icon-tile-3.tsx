import * as React from "react";
import { LayoutDashboardIcon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

export function IconTile3Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<IconTile tone="brand" variant="frame" aria-hidden="true">
				<LayoutDashboardIcon />
			</IconTile>
		</div>
	);
}
