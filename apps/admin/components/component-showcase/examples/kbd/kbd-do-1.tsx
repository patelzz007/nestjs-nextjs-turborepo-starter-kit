import * as React from "react";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";

export function KbdDo1Example(): React.JSX.Element {
	return (
		<p className="flex items-center gap-2 text-sm text-muted-foreground">
			Search
			<KbdGroup aria-label="Command K">
				<Kbd>⌘</Kbd>
				<Kbd>K</Kbd>
			</KbdGroup>
		</p>
	);
}
