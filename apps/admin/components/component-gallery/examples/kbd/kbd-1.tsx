import * as React from "react";
import { Kbd } from "@workspace/ui/components/kbd";

export function Kbd1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-2">
			<Kbd>Ctrl</Kbd>
			<Kbd>⌘K</Kbd>
			<Kbd>Ctrl + B</Kbd>
		</div>
	);
}
