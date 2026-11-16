import * as React from "react";
import { Trace, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";
import { CircleXIcon } from "lucide-react";

export function TraceDont1Example(): React.JSX.Element {
	return (
		<Trace className="w-full max-w-md text-sm">
			<TraceLine>
				<TraceIcon>
					<CircleXIcon aria-hidden="true" className="text-destructive" />
				</TraceIcon>
				<TraceTitle>pnpm lint</TraceTitle>
				<TraceDescription>4s</TraceDescription>
			</TraceLine>
		</Trace>
	);
}
