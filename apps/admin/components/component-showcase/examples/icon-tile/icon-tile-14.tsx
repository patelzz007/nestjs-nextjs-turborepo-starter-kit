import * as React from "react";
import { GlobeIcon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

export function IconTile14Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<span className="relative inline-flex" aria-hidden="true">
				<IconTile tone="brand" variant="elevated">
					<GlobeIcon />
				</IconTile>
				<span className="absolute -end-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-success" />
			</span>
		</div>
	);
}
