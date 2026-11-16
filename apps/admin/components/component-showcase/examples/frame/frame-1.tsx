import * as React from "react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame1Example(): React.JSX.Element {
	return (
		<Frame className="w-full">
			<FrameHeader>
				<FrameTitle>Section header</FrameTitle>
				<FrameDescription>Description for the section</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Section title 2</h2>
				<p className="text-sm text-muted-foreground">Section description</p>
			</FramePanel>
			<FrameFooter>
				<p className="text-sm text-muted-foreground">Section footer</p>
			</FrameFooter>
		</Frame>
	);
}
