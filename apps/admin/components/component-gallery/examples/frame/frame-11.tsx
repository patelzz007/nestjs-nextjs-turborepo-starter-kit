import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame11Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-sm">
			<FrameHeader>
				<FrameTitle>User Profile</FrameTitle>
				<FrameDescription>Manage your personal account details</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Account Security</h2>
				<p className="text-sm text-muted-foreground">Default spacing is the standard for primary application content and main dialogs.</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">Last login: Today at 4:30 PM</p>
			</FrameFooter>
		</Frame>
	);
}
