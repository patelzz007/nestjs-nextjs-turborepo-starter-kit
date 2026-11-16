import * as React from "react";
import { BoldIcon, ItalicIcon, UnderlineIcon } from "lucide-react";
import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle1Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			<Toggle aria-label="Toggle bold" defaultPressed>
				<BoldIcon />
			</Toggle>
			<Toggle aria-label="Toggle italic">
				<ItalicIcon />
			</Toggle>
			<Toggle aria-label="Toggle underline">
				<UnderlineIcon />
			</Toggle>
		</div>
	);
}
