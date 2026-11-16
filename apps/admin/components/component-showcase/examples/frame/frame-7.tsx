import * as React from "react";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

export function Frame7Example(): React.JSX.Element {
	return (
		<Frame dense className="w-full max-w-sm">
			<FrameHeader>
				<FrameTitle>Inventory Check</FrameTitle>
				<FrameDescription>Real-time stock monitoring</FrameDescription>
			</FrameHeader>
			<FramePanel>
				<h2 className="text-sm font-semibold">Warehouse A</h2>
				<p className="text-sm text-muted-foreground">Dense mode removes outer padding for a more compact appearance.</p>
			</FramePanel>
		</Frame>
	);
}
