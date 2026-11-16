import * as React from "react";

export function SeparatorDont2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-2 text-sm">
			<span>Billing</span>
			<hr className="h-1 border-0 bg-pink-500" />
			<span>Team</span>
		</div>
	);
}
