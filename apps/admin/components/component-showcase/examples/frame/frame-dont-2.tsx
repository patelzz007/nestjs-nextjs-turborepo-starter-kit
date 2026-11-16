import * as React from "react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

const SERVICES: readonly string[] = ["API · healthy", "Worker · healthy", "Database · degraded"];

export function FrameDont2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-md flex-col gap-3">
			{SERVICES.map((service: string): React.JSX.Element => (
				<Frame key={service}>
					<FramePanel className="text-sm">{service}</FramePanel>
				</Frame>
			))}
		</div>
	);
}
