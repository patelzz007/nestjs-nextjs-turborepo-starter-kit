import * as React from "react";
import { PackageIcon } from "lucide-react";
import { IconTile, type IconTileVariant } from "@workspace/ui/components/icon-tile";

const variants: readonly IconTileVariant[] = ["outline", "elevated", "soft", "solid", "frame"];

export function IconTile4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-4">
			{variants.map((variant) => (
				<IconTile tone="brand" key={variant} variant={variant} aria-hidden="true">
					<PackageIcon />
				</IconTile>
			))}
		</div>
	);
}
