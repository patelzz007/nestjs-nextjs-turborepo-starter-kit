import type * as React from "react";
import { CircleCheckIcon } from "lucide-react";
import { IconTile, type IconTileTone } from "@workspace/ui/components/icon-tile";

// The `solid` variant is the tone as a full-strength fill with a contrasting glyph.
const tones: readonly IconTileTone[] = ["brand", "blue", "green", "yellow", "red"];

export function IconTile16Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-4">
			{tones.map((tone: IconTileTone): React.JSX.Element => (
				<IconTile key={tone} variant="solid" tone={tone} aria-hidden="true">
					<CircleCheckIcon />
				</IconTile>
			))}
		</div>
	);
}
