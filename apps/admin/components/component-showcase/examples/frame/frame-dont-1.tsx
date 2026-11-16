import * as React from "react";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function FrameDont1Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-md">
			<FrameHeader>
				<FrameTitle>Plan</FrameTitle>
			</FrameHeader>
			<FramePanel>
				<p className="text-sm">Pro</p>
			</FramePanel>
		</Frame>
	);
}
