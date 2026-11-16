import * as React from "react";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame6Example(): React.JSX.Element {
	return (
		<Frame className="w-full" variant="ghost">
			<FrameHeader>
				<FrameTitle>No Outer Border</FrameTitle>
				<FrameDescription>
					This frame uses <code>variant=&quot;ghost&quot;</code> to remove the outer border.
				</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<p className="text-sm text-muted-foreground">The outer container of this frame has no border, only the background and panels are visible.</p>
			</FramePanel>
		</Frame>
	);
}
