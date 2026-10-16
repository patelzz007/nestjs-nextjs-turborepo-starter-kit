import * as React from "react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

export function Frame19Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-sm" stacked>
			<FramePanel>
				<h2 className="text-sm font-semibold">Account Snapshot</h2>
				<p className="text-sm text-muted-foreground">Active seats, usage limits, and billing status are ready for review.</p>
			</FramePanel>
			<FramePanel>
				<h2 className="text-sm font-semibold">Team Activity</h2>
				<p className="text-sm text-muted-foreground">24 members signed in this week with no unresolved security alerts.</p>
			</FramePanel>
		</Frame>
	);
}
