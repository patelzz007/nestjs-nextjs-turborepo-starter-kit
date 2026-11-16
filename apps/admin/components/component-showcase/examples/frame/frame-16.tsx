import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame16Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-sm">
			<FrameHeader>
				<FrameTitle>Default Layout</FrameTitle>
				<FrameDescription>Standard component curvature</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Standard Settings</h2>
				<p className="text-sm text-muted-foreground">The default radius matches the overall design system for consistent application feel.</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">System default applied</p>
			</FrameFooter>
		</Frame>
	);
}
