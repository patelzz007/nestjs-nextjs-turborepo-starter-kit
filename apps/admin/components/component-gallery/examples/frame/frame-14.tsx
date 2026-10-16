import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame14Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-sm [--frame-radius:var(--radius-md)]">
			<FrameHeader>
				<FrameTitle>Media Library</FrameTitle>
				<FrameDescription>Manage your assets and downloads</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Storage Capacity</h2>
				<p className="text-sm text-muted-foreground">Medium radius is a versatile middle ground between sharp and rounded aesthetics.</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">75% of 100GB used</p>
			</FrameFooter>
		</Frame>
	);
}
