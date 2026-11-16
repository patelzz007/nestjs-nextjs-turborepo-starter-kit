import * as React from "react";
import { Separator } from "@workspace/ui/components/separator";

export function SeparatorDo1Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-3 text-sm">
			<div className="flex flex-col gap-1">
				<span>Profile</span>
				<span>Notifications</span>
			</div>
			<Separator />
			<div className="flex flex-col gap-1">
				<span>Sign out</span>
			</div>
		</div>
	);
}
