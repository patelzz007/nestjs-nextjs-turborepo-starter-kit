import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame9Example(): React.JSX.Element {
	return (
		<Frame spacing="xs" className="w-full max-w-xs">
			<FrameHeader>
				<FrameTitle>Project Configuration</FrameTitle>
				<FrameDescription>Adjust your environment settings</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Environment Variables</h2>
				<p className="text-sm text-muted-foreground">XS spacing is ideal for high-density toolbars and property panels.</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">Updated 2m ago</p>
			</FrameFooter>
		</Frame>
	);
}
