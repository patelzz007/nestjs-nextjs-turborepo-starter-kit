import { Trace, TraceLine } from "@workspace/ui-native/components/trace";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";

export function TraceDo1Example(): React.JSX.Element {
	return (
		<Trace>
			<TraceLine icon={TerminalIcon} title="pnpm lint failed with 1 error" status="error" />
		</Trace>
	);
}
