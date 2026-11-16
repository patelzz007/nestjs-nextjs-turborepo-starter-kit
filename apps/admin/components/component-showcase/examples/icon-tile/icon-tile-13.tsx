import type * as React from "react";
import { Settings2Icon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

/** The tile renders as a link (here, back to the gallery's Icon Tile section). */
const SETTINGS_LINK: React.JSX.Element = <a href="#component-icon-tile" aria-label="Open settings" />;

export function IconTile13Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<IconTile
				render={SETTINGS_LINK}
				variant="elevated"
				tone="brand"
				aria-hidden={false}
				className="transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
				<Settings2Icon aria-hidden="true" />
			</IconTile>
		</div>
	);
}
