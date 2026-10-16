import * as React from "react";
import { CircleCheckIcon, GlobeIcon, StarIcon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

export function IconTile6Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-4">
			<IconTile tone="brand" variant="outline" size="lg" radius="full" aria-hidden="true">
				<GlobeIcon />
			</IconTile>
			<IconTile tone="brand" variant="elevated" size="lg" radius="full" aria-hidden="true">
				<StarIcon />
			</IconTile>
			<IconTile tone="brand" variant="frame" size="lg" radius="full" aria-hidden="true">
				<CircleCheckIcon />
			</IconTile>
		</div>
	);
}
