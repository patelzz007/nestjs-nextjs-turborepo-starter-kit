import * as React from "react";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame8Example(): React.JSX.Element {
	return (
		<Frame stacked className="w-full max-w-sm">
			<FrameHeader>
				<FrameTitle>Server Logs</FrameTitle>
				<FrameDescription>Recent activity and errors</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Auth Service</h2>
				<p className="text-sm text-muted-foreground">Successfully logged in user: admin</p>
			</FramePanel>
			<FramePanel>
				<h2 className="text-sm font-semibold">Database</h2>
				<p className="text-sm text-muted-foreground">Query execution time: 12ms</p>
			</FramePanel>
			<FramePanel>
				<h2 className="text-sm font-semibold">Storage</h2>
				<p className="text-sm text-muted-foreground">Upload complete: image.png</p>
			</FramePanel>
		</Frame>
	);
}
