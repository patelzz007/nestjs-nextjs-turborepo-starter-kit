import * as React from "react";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner12Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-4">
			<Spinner className="size-4 text-info" />
			<Spinner className="size-4 text-success" />
			<Spinner className="size-4 text-destructive" />
			<Spinner className="size-4 text-warning" />
			<Spinner className="size-4 text-tone-violet" />
		</div>
	);
}
