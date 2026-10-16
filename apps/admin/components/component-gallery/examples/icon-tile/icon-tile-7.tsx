import * as React from "react";
import { ImageIcon, Settings2Icon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

export function IconTile7Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-4">
			<IconTile tone="brand" variant="elevated" className="size-14" aria-hidden="true">
				<ImageIcon className="size-7" />
			</IconTile>
			<IconTile tone="brand" variant="elevated" className="[--icon-tile-icon-size:--spacing(7)] [--icon-tile-size:--spacing(14)]" aria-hidden="true">
				<Settings2Icon />
			</IconTile>
		</div>
	);
}
