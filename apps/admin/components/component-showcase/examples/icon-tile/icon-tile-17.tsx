import type * as React from "react";
import { CircleAlertIcon, MessageSquareIcon, Settings2Icon, StarIcon } from "lucide-react";
import { IconTile, type IconTileTone } from "@workspace/ui/components/icon-tile";

// Solid, colourful tiles that keep the `elevated` look: the `solid` variant
// paints the tone, and the elevated chip's background-coloured ring and shadow
// are layered on with a class.
interface ElevatedSolidTile {
	readonly tone: IconTileTone;
	readonly icon: React.JSX.Element;
}

const ELEVATED_RING = "border-2 border-background shadow-sm dark:border";

const tiles: readonly ElevatedSolidTile[] = [
	{ tone: "violet", icon: <StarIcon /> },
	{ tone: "orange", icon: <MessageSquareIcon /> },
	{ tone: "green", icon: <Settings2Icon /> },
	{ tone: "red", icon: <CircleAlertIcon /> },
];

export function IconTile17Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-4">
			{tiles.map((tile: ElevatedSolidTile): React.JSX.Element => (
				<IconTile key={tile.tone} variant="solid" tone={tile.tone} className={ELEVATED_RING} aria-hidden="true">
					{tile.icon}
				</IconTile>
			))}
		</div>
	);
}
