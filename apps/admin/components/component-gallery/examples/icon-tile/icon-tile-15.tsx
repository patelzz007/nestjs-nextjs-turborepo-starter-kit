import type * as React from "react";
import { StarIcon } from "lucide-react";
import { IconTile, type IconTileTone } from "@workspace/ui/components/icon-tile";

// The `soft` variant derives every fill and border from currentColor, so the
// `tone` prop (which sets the glyph colour) retints the whole tile.
const tones: readonly IconTileTone[] = ["brand", "blue", "green", "yellow", "red"];

export function IconTile15Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-4">
			{tones.map((tone: IconTileTone): React.JSX.Element => (
				<IconTile key={tone} variant="soft" tone={tone} aria-hidden="true">
					<StarIcon />
				</IconTile>
			))}
		</div>
	);
}
