import * as React from "react";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-6">
			<Spinner />
		</div>
	);
}
