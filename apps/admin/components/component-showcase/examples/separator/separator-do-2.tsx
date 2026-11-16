import * as React from "react";
import { Separator } from "@workspace/ui/components/separator";

export function SeparatorDo2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-2 text-sm">
			<span>Billing</span>
			<Separator />
			<span>Team</span>
		</div>
	);
}
