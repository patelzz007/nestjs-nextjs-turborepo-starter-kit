import * as React from "react";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";

export function KbdDo2Example(): React.JSX.Element {
	return (
		<KbdGroup aria-label="Control Shift P">
			<Kbd>Ctrl</Kbd>
			<Kbd>Shift</Kbd>
			<Kbd>P</Kbd>
		</KbdGroup>
	);
}
