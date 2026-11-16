import * as React from "react";
import { Separator } from "@workspace/ui/components/separator";

export function SeparatorDont1Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-1 rounded-lg border p-2 text-sm">
			<Separator />
			<span>Profile</span>
			<Separator />
			<span>Notifications</span>
			<Separator />
			<span>Sign out</span>
			<Separator />
		</div>
	);
}
