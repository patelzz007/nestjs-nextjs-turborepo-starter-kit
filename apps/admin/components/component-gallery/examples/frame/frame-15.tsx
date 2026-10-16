import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame15Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-sm [--frame-radius:var(--radius-lg)]">
			<FrameHeader>
				<FrameTitle>Team Collaboration</FrameTitle>
				<FrameDescription>Invite and manage workspace members</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Active Members</h2>
				<p className="text-sm text-muted-foreground">Large radius offers a modern, friendly appearance for social and collaborative interfaces.</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">3 members online</p>
			</FrameFooter>
		</Frame>
	);
}
