import * as React from "react";
import { Separator } from "@workspace/ui/components/separator";

export function Separator3Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<div className="flex items-center gap-4 text-sm">
				<div className="flex flex-col gap-1">
					<span className="font-medium">Settings</span>
					<span className="text-xs text-muted-foreground">Manage preferences</span>
				</div>
				<Separator orientation="vertical" className="h-8 [&]:self-auto!" />
				<div className="flex flex-col gap-1">
					<span className="font-medium">Account</span>
					<span className="text-xs text-muted-foreground">Profile & security</span>
				</div>
				<Separator orientation="vertical" className="h-8 [&]:self-auto!" />
				<div className="flex flex-col gap-1">
					<span className="font-medium">Help</span>
					<span className="text-xs text-muted-foreground">Support & docs</span>
				</div>
			</div>
		</div>
	);
}
