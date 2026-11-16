import * as React from "react";
import { PackageIcon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

export function IconTile2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<IconTile tone="brand" variant="elevated" aria-hidden="true">
				<PackageIcon />
			</IconTile>
		</div>
	);
}
