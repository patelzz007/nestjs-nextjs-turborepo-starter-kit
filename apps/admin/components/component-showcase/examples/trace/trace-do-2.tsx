import * as React from "react";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";
import { TerminalIcon } from "lucide-react";

export function TraceDo2Example(): React.JSX.Element {
	return (
		<Trace className="w-full max-w-md text-sm">
			<TraceCollapsible>
				<TraceCollapsibleTrigger>
					<TraceLine>
						<TraceIcon>
							<TerminalIcon aria-hidden="true" />
						</TraceIcon>
						<TraceTitle>pnpm lint failed with 1 error</TraceTitle>
						<TraceDescription>4s</TraceDescription>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>
					<pre className="rounded-md bg-muted p-2 font-mono text-xs">src/app.tsx:12:5 error &apos;user&apos; is never used</pre>
				</TraceCollapsibleContent>
			</TraceCollapsible>
		</Trace>
	);
}
