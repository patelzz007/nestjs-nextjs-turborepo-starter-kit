import * as React from "react";
import { PackageIcon } from "lucide-react";
import { IconTile, type IconTileSize } from "@workspace/ui/components/icon-tile";

const sizes: readonly IconTileSize[] = ["xs", "sm", "default", "lg", "xl"];

export function IconTile5Example(): React.JSX.Element {
	return (
		<div className="flex items-end justify-center gap-4">
			{sizes.map((size) => (
				<IconTile tone="brand" key={size} variant="elevated" size={size} aria-hidden="true">
					<PackageIcon />
				</IconTile>
			))}
		</div>
	);
}
