import * as React from "react";
import { BoldIcon, ItalicIcon } from "lucide-react";
import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle2Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			<Toggle variant="outline" aria-label="Toggle italic">
				<ItalicIcon />
				Italic
			</Toggle>
			<Toggle variant="outline" aria-label="Toggle bold">
				<BoldIcon />
				Bold
			</Toggle>
		</div>
	);
}
