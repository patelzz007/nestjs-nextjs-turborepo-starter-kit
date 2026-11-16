import * as React from "react";
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";
import { TerminalIcon } from "lucide-react";

export function TraceDont2Example(): React.JSX.Element {
	return (
		<Trace className="w-full max-w-md text-sm">
			<TraceLine>
				<TraceIcon>
					<TerminalIcon aria-hidden="true" />
				</TraceIcon>
				<TraceTitle>pnpm install</TraceTitle>
			</TraceLine>
			<pre className="rounded-md bg-muted p-2 font-mono text-xs">Packages: +1,204{"\n"}Progress: resolved 1204, reused 1204, downloaded 0, added 1204, done</pre>
			<TraceLine>
				<TraceIcon>
					<TerminalIcon aria-hidden="true" />
				</TraceIcon>
				<TraceTitle>pnpm lint failed with 1 error</TraceTitle>
			</TraceLine>
			<pre className="rounded-md bg-muted p-2 font-mono text-xs">src/app.tsx:12:5 error &apos;user&apos; is never used</pre>
		</Trace>
	);
}
