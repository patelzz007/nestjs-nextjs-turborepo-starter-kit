import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame13Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-sm [--frame-radius:var(--radius-sm)]">
			<FrameHeader>
				<FrameTitle>Network Diagnostics</FrameTitle>
				<FrameDescription>Analyzing real-time socket connections</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Port Status</h2>
				<p className="text-sm text-muted-foreground">Small radius gives a sharp, precise look, perfect for technical dashboards and data grids.</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">Scan completed</p>
			</FrameFooter>
		</Frame>
	);
}
