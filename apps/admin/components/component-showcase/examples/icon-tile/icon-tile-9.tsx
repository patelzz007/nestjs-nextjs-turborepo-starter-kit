import * as React from "react";
import { IconTile } from "@workspace/ui/components/icon-tile";

export function IconTile9Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-3">
			<IconTile tone="brand" variant="elevated" className="text-xs font-medium">
				AK
			</IconTile>
			<IconTile tone="neutral" variant="outline" radius="full" className="text-xs font-medium">
				12
			</IconTile>
		</div>
	);
}
