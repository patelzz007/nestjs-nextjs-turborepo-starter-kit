import * as React from "react";
import { Spinner } from "@workspace/ui/components/spinner";

export function SpinnerDont1Example(): React.JSX.Element {
	return (
		<div className="grid w-64 grid-cols-2 gap-3">
			<div className="flex h-12 items-center justify-center rounded-md border">
				<Spinner />
			</div>
			<div className="flex h-12 items-center justify-center rounded-md border">
				<Spinner />
			</div>
			<div className="flex h-12 items-center justify-center rounded-md border">
				<Spinner />
			</div>
			<div className="flex h-12 items-center justify-center rounded-md border">
				<Spinner />
			</div>
		</div>
	);
}
