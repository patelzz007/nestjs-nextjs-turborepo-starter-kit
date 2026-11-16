import * as React from "react";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner9Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-xs flex-col gap-3">
			<div className="flex items-center gap-2">
				<Spinner className="size-3.5" />
				<span className="text-sm text-muted-foreground">Checking availability...</span>
			</div>
			<div className="flex items-center gap-2">
				<Spinner className="size-3.5 text-success" />
				<span className="text-sm">
					<span className="font-medium text-success">Connected</span>
					<span className="text-muted-foreground"> — syncing data</span>
				</span>
			</div>
			<div className="flex items-center gap-2">
				<Spinner className="size-3.5 text-warning" />
				<span className="text-sm">
					<span className="font-medium text-warning">Reconnecting</span>
					<span className="text-muted-foreground"> — attempt 3 of 5</span>
				</span>
			</div>
		</div>
	);
}
