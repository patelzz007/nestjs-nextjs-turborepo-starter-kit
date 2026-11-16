import * as React from "react";
import { Spinner } from "@workspace/ui/components/spinner";

export function SpinnerDo1Example(): React.JSX.Element {
	return (
		<div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
			<Spinner aria-hidden="true" />
			Loading invoices…
		</div>
	);
}
