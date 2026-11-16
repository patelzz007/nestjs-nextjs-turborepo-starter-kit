import * as React from "react";
import { BoldIcon, ItalicIcon } from "lucide-react";
import { Toggle } from "@workspace/ui/components/toggle";

export function ToggleDo2Example(): React.JSX.Element {
	return (
		<div className="flex w-64 flex-col gap-2">
			<div className="flex gap-1">
				<Toggle aria-label="Bold" defaultPressed>
					<BoldIcon aria-hidden="true" />
				</Toggle>
				<Toggle aria-label="Italic">
					<ItalicIcon aria-hidden="true" />
				</Toggle>
			</div>
			<p className="rounded-md border border-border p-2 text-sm font-bold">The quarterly report is ready.</p>
		</div>
	);
}
