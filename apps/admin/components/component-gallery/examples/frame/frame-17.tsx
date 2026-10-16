import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame17Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-sm [--frame-radius:var(--radius-2xl)]">
			<FrameHeader>
				<FrameTitle>Creative Portfolio</FrameTitle>
				<FrameDescription>Showcasing visual art and design</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Gallery View</h2>
				<p className="text-sm text-muted-foreground">2XL radius provides a very soft, organic look suitable for creative portfolios and landing pages.</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">Browse 12 projects</p>
			</FrameFooter>
		</Frame>
	);
}
