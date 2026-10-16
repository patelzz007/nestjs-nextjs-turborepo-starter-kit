import * as React from "react";
import { FolderIcon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

export function IconTile1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<IconTile variant="outline" tone="brand" aria-hidden="true">
				<FolderIcon />
			</IconTile>
		</div>
	);
}
