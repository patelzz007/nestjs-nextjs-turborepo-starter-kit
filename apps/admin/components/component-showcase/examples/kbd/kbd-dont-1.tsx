import * as React from "react";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";

export function KbdDont1Example(): React.JSX.Element {
	return (
		<KbdGroup>
			<Kbd>⌘</Kbd>
			<Kbd>⇧</Kbd>
			<Kbd>K</Kbd>
		</KbdGroup>
	);
}
