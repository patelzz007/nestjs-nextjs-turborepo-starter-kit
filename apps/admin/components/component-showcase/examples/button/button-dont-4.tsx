import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

export function ButtonDont4Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2">
			<Button>Save</Button>
			<Spinner aria-label="Saving" />
		</div>
	);
}
