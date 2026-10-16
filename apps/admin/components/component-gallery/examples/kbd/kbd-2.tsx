import * as React from "react";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";

export function Kbd2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<KbdGroup>
				<Kbd>Ctrl</Kbd>
				<Kbd>Shift</Kbd>
				<Kbd>P</Kbd>
			</KbdGroup>
		</div>
	);
}
