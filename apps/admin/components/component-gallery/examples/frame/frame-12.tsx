import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame12Example(): React.JSX.Element {
	return (
		<Frame spacing="lg" className="w-full max-w-sm">
			<FrameHeader>
				<FrameTitle>System Analytics</FrameTitle>
				<FrameDescription>Global traffic and usage patterns</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Performance Metrics</h2>
				<p className="text-sm text-muted-foreground">Large spacing creates a focused, airy feel suitable for marketing pages or empty states.</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">View full report</p>
			</FrameFooter>
		</Frame>
	);
}
