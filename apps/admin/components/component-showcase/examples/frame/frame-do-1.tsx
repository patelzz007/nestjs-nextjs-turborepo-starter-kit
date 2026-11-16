import * as React from "react";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function FrameDo1Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-md">
			<FrameHeader>
				<FrameTitle>Billing</FrameTitle>
				<FrameDescription>Your plan and how you pay.</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<p className="text-sm font-medium">Pro plan</p>
				<p className="text-sm text-muted-foreground">$24 a month</p>
			</FramePanel>
			<FramePanel>
				<p className="text-sm font-medium">Visa ending 4242</p>
				<p className="text-sm text-muted-foreground">Expires 08/28</p>
			</FramePanel>
		</Frame>
	);
}
