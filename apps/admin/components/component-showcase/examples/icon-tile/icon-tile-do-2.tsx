import * as React from "react";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { Settings2Icon } from "lucide-react";

const SETTINGS_LINK: React.JSX.Element = <a href="#component-icon-tile" aria-label="Open settings" />;

export function IconTileDo2Example(): React.JSX.Element {
	return (
		<IconTile render={SETTINGS_LINK} tone="brand" aria-hidden={false} className="outline-none focus-visible:ring-2 focus-visible:ring-ring">
			<Settings2Icon aria-hidden="true" />
		</IconTile>
	);
}
