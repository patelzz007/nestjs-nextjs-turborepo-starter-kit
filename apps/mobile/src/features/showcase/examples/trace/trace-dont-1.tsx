import { Trace, TraceLine } from "@workspace/ui-native/components/trace";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";

// Only the colour says it failed: a screen reader hears "pnpm lint" and nothing more.
export function TraceDont1Example(): React.JSX.Element {
	return (
		<Trace>
			<TraceLine icon={TerminalIcon} title="pnpm lint" status="error" />
		</Trace>
	);
}
