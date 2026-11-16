import * as React from "react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

const SERVICES: readonly string[] = ["API · healthy", "Worker · healthy", "Database · degraded"];

export function FrameDo2Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-md">
			{SERVICES.map((service: string): React.JSX.Element => (
				<FramePanel key={service} className="text-sm">
					{service}
				</FramePanel>
			))}
		</Frame>
	);
}
