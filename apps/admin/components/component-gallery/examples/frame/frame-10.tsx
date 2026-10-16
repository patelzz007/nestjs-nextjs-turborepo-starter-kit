import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame10Example(): React.JSX.Element {
	return (
		<Frame spacing="sm" className="w-full max-w-sm">
			<FrameHeader>
				<FrameTitle>Database Overview</FrameTitle>
				<FrameDescription>Monitoring system health and performance</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Live Connections</h2>
				<p className="text-sm text-muted-foreground">Small spacing provides a balanced layout for sidebar widgets and secondary dashboards.</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">Status: Operational</p>
			</FrameFooter>
		</Frame>
	);
}
